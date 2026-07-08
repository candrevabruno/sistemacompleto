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
        .select('nome, subtitulo, logo_url, chatwoot_url, whatsapp_provider, meta_phone_number_id, meta_business_account_id, evolution_server_url, evolution_instance_name, uazapi_server_url, uazapi_instance_name, nota_webhook_url, premium_enabled, eventos_enabled, lista_espera_enabled, aniversario_webhook_url, upgrade_webhook_url, heroic_leap_whatsapp, admin_config_tabs, aniversario_last_dispatch, tally_formulario_id, tally_webhook_url')
        .eq('id', 1)
        .single();

      if (error) {
        // Fallback para bancos que ainda não rodaram a migration do Tally.
        // Busca todas as colunas pré-existentes para não perder feature flags
        // nem admin_config_tabs que podem estar configurados no banco.
        const fallback = await supabase
          .from('clinic_config')
          .select('nome, subtitulo, logo_url, chatwoot_url, whatsapp_provider, meta_phone_number_id, meta_business_account_id, evolution_server_url, evolution_instance_name, nota_webhook_url, premium_enabled, eventos_enabled, lista_espera_enabled, aniversario_webhook_url, upgrade_webhook_url, heroic_leap_whatsapp, admin_config_tabs, aniversario_last_dispatch')
          .eq('id', 1)
          .single();
        if (!fallback.error && fallback.data) {
          data = {
            ...fallback.data,
            uazapi_server_url: null,
            uazapi_instance_name: null,
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
