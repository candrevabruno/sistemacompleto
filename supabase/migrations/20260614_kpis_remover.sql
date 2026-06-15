-- DASHBOARD — remove KPIs descontinuados do catálogo.
-- Taxa de Fechamento, Contato em 30 min e Taxa de Churn saem do catálogo e da
-- exibição. O ON DELETE CASCADE de clinic_kpi_selection limpa as seleções.
DELETE FROM public.kpi_catalog
 WHERE codigo IN ('com_taxa_fechamento', 'com_contato_30min', 'exp_churn');
