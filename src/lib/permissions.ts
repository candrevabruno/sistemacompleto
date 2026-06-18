// ETAPA 5 — Catálogo de permissões granulares (fonte única de verdade)
//
// Hierarquia: super_admin (Heroic Leap) → admin (dono/médico) → membro
//  - super_admin e admin: acesso TOTAL (bypass do catálogo).
//  - membro: acesso definido item a item em user_permissions.
//
// Cada item tem um nível: 'none' | 'view' | 'view_edit'.
// Itens não editáveis (ex.: Dashboard) só oferecem 'view'.

export type PermLevel = 'none' | 'view' | 'view_edit';

export type PermGroup = 'modulo' | 'paciente_tab' | 'feature';

export type FeatureFlag = 'premium_enabled' | 'eventos_enabled';

export interface PermItem {
  key: string;
  label: string;
  group: PermGroup;
  /** Se false, só oferece 'view' (sem opção de editar). */
  editable: boolean;
  /** Rota associada (para gating de módulos no sidebar/rotas). */
  route?: string;
  /** Só aparece quando a Heroic Leap liberou essa feature na clínica. */
  featureFlag?: FeatureFlag;
  /** Sub-opção de feature (ex.: secretária controla disparos de Eventos). */
  parentKey?: string;
}

export const PERM_GROUP_LABEL: Record<PermGroup, string> = {
  modulo: 'Módulos',
  paciente_tab: 'Abas do paciente',
  feature: 'Recursos liberados',
};

export const PERM_ITEMS: PermItem[] = [
  // ── Módulos ────────────────────────────────────────────────────────────────
  { key: 'modulo:dashboard',     label: 'Dashboard',     group: 'modulo', editable: false, route: '/dashboard' },
  { key: 'modulo:agenda',        label: 'Agenda',        group: 'modulo', editable: true,  route: '/central-agendamentos' },
  { key: 'modulo:leads',         label: 'Leads',         group: 'modulo', editable: true,  route: '/leads' },
  { key: 'modulo:pacientes',     label: 'Pacientes',     group: 'modulo', editable: true,  route: '/pacientes' },
  { key: 'modulo:crm',           label: 'CRM Kanban',    group: 'modulo', editable: true,  route: '/crm' },
  { key: 'modulo:inbox',         label: 'Inbox',         group: 'modulo', editable: true,  route: '/inbox' },
  { key: 'modulo:equipe',        label: 'Equipe',        group: 'modulo', editable: true,  route: '/equipe' },
  { key: 'modulo:configuracoes', label: 'Configurações', group: 'modulo', editable: true,  route: '/configuracoes' },
  { key: 'modulo:financeiro',    label: 'Financeiro',    group: 'modulo', editable: true,  route: '/financeiro' },

  // ── Abas de Pacientes (controle aba por aba) ─────────────────────────────────
  { key: 'paciente_tab:dados',         label: 'Dados',                     group: 'paciente_tab', editable: true },
  { key: 'paciente_tab:consultas',     label: 'Consultas',                 group: 'paciente_tab', editable: true },
  { key: 'paciente_tab:procedimentos', label: 'Procedimentos',             group: 'paciente_tab', editable: true },
  { key: 'paciente_tab:comportamento', label: 'Comportamento',             group: 'paciente_tab', editable: false },
  { key: 'paciente_tab:profissional',  label: 'Anotações do Profissional', group: 'paciente_tab', editable: true },
  { key: 'paciente_tab:pre_consulta',  label: 'Pré-Consulta',              group: 'paciente_tab', editable: true },
  { key: 'paciente_tab:pos_consulta',  label: 'Pós-Consulta',              group: 'paciente_tab', editable: true },

  // ── Recursos liberados pela Heroic Leap ──────────────────────────────────────
  { key: 'feature:premium',          label: 'Experiência Premium',       group: 'feature', editable: true, featureFlag: 'premium_enabled' },
  { key: 'feature:eventos',          label: 'Módulo Eventos',            group: 'feature', editable: true, featureFlag: 'eventos_enabled' },
  { key: 'feature:eventos:disparos', label: 'Controlar disparos e ações', group: 'feature', editable: true, featureFlag: 'eventos_enabled', parentKey: 'feature:eventos' },

  // ── Admin-only (admin/super_admin têm bypass automático; membro=none por padrão) ─
  { key: 'modulo:auditoria', label: 'Auditoria', group: 'modulo', editable: false, route: '/auditoria' },
];

export const PERM_ITEM_BY_KEY: Record<string, PermItem> = Object.fromEntries(
  PERM_ITEMS.map(i => [i.key, i]),
);

/** Níveis selecionáveis para um item (Dashboard etc. não têm view_edit). */
export function levelsFor(item: PermItem): PermLevel[] {
  return item.editable ? ['none', 'view', 'view_edit'] : ['none', 'view'];
}

export const LEVEL_LABEL: Record<PermLevel, string> = {
  none: 'Sem acesso',
  view: 'Só visualizar',
  view_edit: 'Visualizar e editar',
};

/** Itens visíveis dado o estado das feature flags da clínica. */
export function visibleItems(flags: { premium_enabled?: boolean; eventos_enabled?: boolean } | null | undefined): PermItem[] {
  return PERM_ITEMS.filter(item => {
    if (!item.featureFlag) return true;
    return Boolean(flags?.[item.featureFlag]);
  });
}

export type PermissionMap = Record<string, PermLevel>;

/**
 * Resolve o nível de um item para um usuário.
 * super_admin/admin têm acesso total (view_edit em tudo).
 */
export function resolveLevel(
  role: string | undefined,
  perms: PermissionMap,
  itemKey: string,
): PermLevel {
  if (role === 'admin' || role === 'super_admin') return 'view_edit';
  return perms[itemKey] ?? 'none';
}

/** Pode ao menos visualizar o item? */
export function canView(role: string | undefined, perms: PermissionMap, itemKey: string): boolean {
  const lvl = resolveLevel(role, perms, itemKey);
  return lvl === 'view' || lvl === 'view_edit';
}

/** Pode editar o item? */
export function canEdit(role: string | undefined, perms: PermissionMap, itemKey: string): boolean {
  return resolveLevel(role, perms, itemKey) === 'view_edit';
}
