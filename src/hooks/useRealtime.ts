import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Assina mudanças (INSERT/UPDATE/DELETE) nas tabelas informadas e chama `onChange`
 * quando qualquer uma muda — para a tela atualizar sozinha, sem F5.
 *
 * - `onChange` pode ser uma função inline: usamos uma ref para sempre chamar a versão
 *   mais recente sem reassinar o canal a cada render.
 * - Debounce de 150ms agrupa rajadas de eventos (vários INSERT/UPDATE) num refetch só.
 *
 * Requisito: as tabelas precisam estar na publicação `supabase_realtime`
 * (ver migration supabase/migrations/20260621_realtime_publication.sql).
 */
export function useRealtime(tables: string[], onChange: () => void) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  const key = tables.join(',');
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cbRef.current(), 150);
    };
    const ch = supabase.channel(`rt-${key}-${Math.random().toString(36).slice(2)}`);
    for (const table of tables) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, fire);
    }
    ch.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [key]);
}
