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
      const { data, error } = await supabase
        .from('clinic_config')
        .select('nome, logo_url')
        .eq('id', 1)
        .single();
        
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
