import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ClinicConfig } from '../types';

interface ClinicContextType {
  config: ClinicConfig | null;
  loading: boolean;
  refreshConfig: () => Promise<void>;
}

const ClinicContext = createContext<ClinicContextType>({
  config: null,
  loading: true,
  refreshConfig: async () => {},
});

export const ClinicProvider = ({ children }: { children: React.ReactNode }) => {
  const [config, setConfig] = useState<ClinicConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshConfig = async () => {
    try {
      let { data, error } = await supabase
        .from('clinic_config')
        .select('nome, subtitulo, logo_url, chatwoot_url, whatsapp_provider, meta_phone_number_id, meta_business_account_id, evolution_server_url, evolution_instance_name, nota_webhook_url, premium_enabled, eventos_enabled, lista_espera_enabled, aniversario_webhook_url, upgrade_webhook_url, heroic_leap_whatsapp, admin_config_tabs, aniversario_last_dispatch, tally_formulario_id, tally_webhook_url')
        .eq('id', 1)
        .single();

      if (error) {
        // Fallback para bancos que ainda não rodaram o stage1_inbox_schema.sql
        const fallback = await supabase
          .from('clinic_config')
          .select('nome, logo_url, chatwoot_url')
          .eq('id', 1)
          .single();
        if (!fallback.error && fallback.data) {
          data = {
            ...fallback.data,
            subtitulo: null,
            chatwoot_url: null,
            whatsapp_provider: null,
            meta_phone_number_id: null,
            meta_business_account_id: null,
            evolution_server_url: null,
            evolution_instance_name: null,
            nota_webhook_url: null,
            premium_enabled: false,
            eventos_enabled: false,
            lista_espera_enabled: false,
            aniversario_webhook_url: null,
            upgrade_webhook_url: null,
            heroic_leap_whatsapp: null,
            admin_config_tabs: null,
            aniversario_last_dispatch: null,
            tally_formulario_id: null,
            tally_webhook_url: null,
          };
          error = null;
        }
      }

      if (!error && data) {
        setConfig(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshConfig();
  }, []);

  return (
    <ClinicContext.Provider value={{ config, loading, refreshConfig }}>
      {children}
    </ClinicContext.Provider>
  );
};

export const useClinic = () => useContext(ClinicContext);
