import React, { useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Upload, Download, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface RowPreview {
  nome: string;
  whatsapp: string;
  email?: string;
  procedimento?: string;
  data_nascimento?: string;
  erro?: string;
}

const COLUNAS_MODELO = ['nome', 'whatsapp', 'email', 'procedimento_interesse', 'data_nascimento'];
const TEMPLATE_CSV =
  'nome,whatsapp,email,procedimento_interesse,data_nascimento\n' +
  'Maria Silva,5511999990001,maria@email.com,Consulta de rotina,1985-03-20\n' +
  'João Souza,5511999990002,,Dermatologia,\n';

function parseCSV(text: string): Record<string, string>[] {
  const raw = text.replace(/\r/g, '');
  const lines = raw.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']));
  });
}

function mapRow(raw: Record<string, string>): RowPreview {
  const nome = raw['nome'] || raw['name'] || '';
  const whatsapp = (raw['whatsapp'] || raw['telefone'] || raw['phone'] || '').replace(/\D/g, '');
  const email = raw['email'] || '';
  const procedimento = raw['procedimento_interesse'] || raw['procedimento'] || '';
  const data_nascimento = raw['data_nascimento'] || raw['nascimento'] || '';
  let erro: string | undefined;
  if (!nome.trim()) erro = 'Nome obrigatório';
  else if (!whatsapp) erro = 'WhatsApp obrigatório';
  else if (whatsapp.length < 10) erro = 'WhatsApp inválido (mínimo 10 dígitos)';
  return { nome, whatsapp, email, procedimento, data_nascimento, erro };
}

const tdSt: React.CSSProperties = {
  padding: '7px 10px', fontSize: '11.5px', color: 'var(--ink)',
  borderBottom: '1px solid var(--border)', verticalAlign: 'middle',
};

export function ImportarPacientesModal({ isOpen, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<RowPreview[]>([]);
  const [fileName, setFileName] = useState('');
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: number; err: number } | null>(null);

  const validas = rows.filter(r => !r.erro);
  const comErro = rows.filter(r => r.erro);

  const handleFile = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setResultado(null);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const raw = parseCSV(text);
      setRows(raw.map(mapRow));
    };
    reader.readAsText(file, 'UTF-8');
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) handleFile(file);
  };

  const baixarModelo = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'modelo_importar_pacientes.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  const importar = async () => {
    if (!validas.length || !user) return;
    setImportando(true);
    let ok = 0; let err = 0;
    for (const row of validas) {
      try {
        const { data: lead, error } = await supabase.from('leads').insert({
          nome_lead: row.nome,
          whatsapp_lead: row.whatsapp,
          email: row.email || null,
          procedimento_interesse: row.procedimento || null,
          data_nascimento: row.data_nascimento || null,
          status: 'converteu',
          converteu_em: new Date().toISOString(),
          converteu_por: user.id,
        }).select('id').single();
        if (error) throw error;
        if (lead?.id) {
          await supabase.from('pacientes').insert({ lead_id: lead.id });
        }
        ok++;
      } catch {
        err++;
      }
    }
    setImportando(false);
    setResultado({ ok, err });
    if (ok > 0) setTimeout(onSuccess, 1500);
  };

  const resetar = () => { setRows([]); setFileName(''); setResultado(null); };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Importar pacientes"
      className="max-w-2xl mx-4"
      footer={
        resultado ? (
          <button onClick={onClose} style={{ padding: '7px 18px', fontSize: '12.5px', fontWeight: 600, background: 'var(--sage-dark)', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', cursor: 'pointer', fontFamily: 'inherit' }}>
            Fechar
          </button>
        ) : rows.length > 0 ? (
          <>
            <button onClick={resetar} style={{ padding: '7px 14px', fontSize: '12.5px', fontWeight: 500, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Trocar arquivo
            </button>
            <button
              onClick={importar}
              disabled={importando || validas.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 18px', fontSize: '12.5px', fontWeight: 600, background: 'var(--sage-dark)', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', cursor: 'pointer', fontFamily: 'inherit', opacity: (importando || !validas.length) ? 0.5 : 1 }}
            >
              {importando ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Importar {validas.length} paciente{validas.length !== 1 ? 's' : ''}
            </button>
          </>
        ) : null
      }
    >
      {/* Resultado final */}
      {resultado && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '16px 0', textAlign: 'center' }}>
          <CheckCircle size={40} style={{ color: 'var(--sage-dark)' }} />
          <div>
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>
              {resultado.ok} paciente{resultado.ok !== 1 ? 's' : ''} importado{resultado.ok !== 1 ? 's' : ''} com sucesso!
            </p>
            {resultado.err > 0 && (
              <p style={{ fontSize: '12px', color: 'var(--rose-text)', marginTop: '4px' }}>
                {resultado.err} registro{resultado.err !== 1 ? 's' : ''} com erro foram ignorados.
              </p>
            )}
          </div>
        </div>
      )}

      {!resultado && rows.length === 0 && (
        <>
          {/* Zona de drop */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            style={{ border: '2px dashed var(--border-md)', borderRadius: 'var(--r-sm)', padding: '36px 24px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg)', transition: 'border-color 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--sage-dark)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-md)')}
          >
            <Upload size={28} style={{ color: 'var(--muted)', marginBottom: '10px' }} />
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>
              Arraste o arquivo CSV aqui ou clique para selecionar
            </p>
            <p style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '5px' }}>
              Colunas obrigatórias: <strong>nome</strong>, <strong>whatsapp</strong>
            </p>
            <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
              Opcionais: email, procedimento_interesse, data_nascimento
            </p>
            <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>

          <button
            onClick={baixarModelo}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', padding: '6px 12px', fontSize: '12px', fontWeight: 500, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <Download size={13} />
            Baixar modelo CSV
          </button>
        </>
      )}

      {!resultado && rows.length > 0 && (
        <>
          {/* Resumo */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: 'var(--sage-xlight)', borderRadius: 'var(--r-xs)' }}>
              <CheckCircle size={13} style={{ color: 'var(--sage-dark)' }} />
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--sage-dark)' }}>{validas.length} válidos</span>
            </div>
            {comErro.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: 'var(--rose-light)', borderRadius: 'var(--r-xs)' }}>
                <AlertCircle size={13} style={{ color: 'var(--rose-text)' }} />
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--rose-text)' }}>{comErro.length} com erro</span>
              </div>
            )}
            <span style={{ fontSize: '11px', color: 'var(--muted)', alignSelf: 'center' }}>{fileName}</span>
          </div>

          {/* Tabela preview */}
          <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', fontSize: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Nome', 'WhatsApp', 'Email', 'Procedimento', 'Nascimento', ''].map(h => (
                    <th key={h} style={{ ...tdSt, fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--muted)', background: 'var(--bg)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ background: row.erro ? 'rgba(246,214,214,0.3)' : 'transparent' }}>
                    <td style={tdSt}>{row.nome || <span style={{ color: 'var(--rose-text)' }}>—</span>}</td>
                    <td style={tdSt}>{row.whatsapp || <span style={{ color: 'var(--rose-text)' }}>—</span>}</td>
                    <td style={{ ...tdSt, color: 'var(--muted)' }}>{row.email || '—'}</td>
                    <td style={{ ...tdSt, color: 'var(--muted)' }}>{row.procedimento || '—'}</td>
                    <td style={{ ...tdSt, color: 'var(--muted)' }}>{row.data_nascimento || '—'}</td>
                    <td style={{ ...tdSt, width: '24px' }}>
                      {row.erro
                        ? <span title={row.erro}><AlertCircle size={13} style={{ color: 'var(--rose-text)' }} /></span>
                        : <CheckCircle size={13} style={{ color: 'var(--sage-dark)' }} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {comErro.length > 0 && (
            <div style={{ marginTop: '10px', padding: '8px 12px', background: 'var(--rose-light)', borderRadius: 'var(--r-xs)', border: '1px solid rgba(139,68,68,0.2)' }}>
              <p style={{ fontSize: '11.5px', color: 'var(--rose-text)', fontWeight: 500 }}>
                Linhas com erro serão ignoradas na importação.
              </p>
              <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '11px', color: 'var(--rose-text)' }}>
                {comErro.slice(0, 3).map((r, i) => (
                  <li key={i}><strong>{r.nome || `Linha ${i + 2}`}</strong>: {r.erro}</li>
                ))}
                {comErro.length > 3 && <li>...e mais {comErro.length - 3}</li>}
              </ul>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
