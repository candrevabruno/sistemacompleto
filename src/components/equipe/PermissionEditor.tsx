import React from 'react';
import {
  PERM_GROUP_LABEL,
  levelsFor,
  LEVEL_LABEL,
  visibleItems,
} from '../../lib/permissions';
import type { PermItem, PermLevel, PermissionMap, PermGroup } from '../../lib/permissions';

interface Props {
  value: PermissionMap;
  onChange: (next: PermissionMap) => void;
  /** Feature flags da clínica — controlam quais itens aparecem. */
  flags: { premium_enabled?: boolean; eventos_enabled?: boolean } | null | undefined;
}

const GROUP_ORDER: PermGroup[] = ['modulo', 'paciente_tab', 'config_tab', 'feature'];

/**
 * Editor de permissões granulares. Cada item mostra o NÍVEL DE ACESSO ao lado
 * (só as opções que fazem sentido — itens sem edição só têm "Só visualizar").
 * Reutilizado no convite e na edição de um membro.
 */
export function PermissionEditor({ value, onChange, flags }: Props) {
  const items = visibleItems(flags);

  const setLevel = (key: string, level: PermLevel) => {
    const next = { ...value };
    if (level === 'none') delete next[key];
    else next[key] = level;
    onChange(next);
  };

  const grouped: Record<PermGroup, PermItem[]> = { modulo: [], paciente_tab: [], config_tab: [], feature: [] };
  items.forEach(i => grouped[i.group].push(i));

  return (
    <div className="space-y-5">
      {GROUP_ORDER.map(group => {
        const groupItems = grouped[group];
        if (groupItems.length === 0) return null;
        return (
          <div key={group}>
            <p className="text-[10px] font-semibold uppercase tracking-[1.1px] mb-2" style={{ color: 'var(--muted)' }}>
              {PERM_GROUP_LABEL[group]}
            </p>
            <div className="space-y-1.5">
              {groupItems.map(item => {
                const current: PermLevel = value[item.key] ?? 'none';
                const isSub = Boolean(item.parentKey);
                // Sub-item só é editável se o pai tem algum acesso.
                const parentActive = !item.parentKey || (value[item.parentKey] && value[item.parentKey] !== 'none');
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-3 py-1.5"
                    style={isSub ? { paddingLeft: 16 } : undefined}
                  >
                    <span
                      className="text-sm truncate"
                      style={{ color: parentActive ? 'var(--ink)' : 'var(--muted)' }}
                    >
                      {isSub && <span style={{ color: 'var(--muted)', marginRight: 6 }}>↳</span>}
                      {item.label}
                    </span>
                    <select
                      value={current}
                      disabled={!parentActive}
                      onChange={e => setLevel(item.key, e.target.value as PermLevel)}
                      className="text-xs rounded-[6px] px-2 py-1.5 focus:outline-none disabled:opacity-40 flex-shrink-0"
                      style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', minWidth: 150 }}
                    >
                      {levelsFor(item).map(lvl => (
                        <option key={lvl} value={lvl}>{LEVEL_LABEL[lvl]}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
