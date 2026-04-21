import json
import os
import glob

def parse_sql_schema():
    sql = """
CREATE TABLE public.leads (
  id UUID,
  whatsapp_lead TEXT,
  inicio_atendimento TIMESTAMPTZ,
  nome_lead TEXT,
  motivo_contato TEXT,
  procedimento_interesse TEXT,
  resumo_conversa TEXT,
  status TEXT,
  ultima_mensagem TIMESTAMPTZ,
  id_conta_chatwoot TEXT,
  id_conversa_chatwoot TEXT,
  id_lead_chatwoot TEXT,
  inbox_id_chatwoot TEXT,
  follow_up_1 TIMESTAMPTZ,
  follow_up_2 TIMESTAMPTZ,
  follow_up_3 TIMESTAMPTZ,
  data_agendamento TIMESTAMPTZ,
  agendamento_criado_em TIMESTAMPTZ,
  id_agendamento TEXT,
  observacoes TEXT,
  data_nascimento DATE,
  genero TEXT,
  valor_pago NUMERIC
);
CREATE TABLE public.agendamentos (
  id UUID,
  agenda_id UUID,
  lead_id UUID,
  cliente_id UUID,
  procedimento_nome TEXT,
  nome_lead TEXT,
  whatsapp_lead TEXT,
  data_hora_inicio TIMESTAMPTZ,
  data_hora_fim TIMESTAMPTZ,
  status TEXT,
  observacoes TEXT,
  valor_pago NUMERIC
);
"""
    pass

def audit_jsons():
    base_dir = '/Users/elenmendes/Desktop/Heroic Leap - Sistema Completo/automacoes'
    json_files = glob.glob(f'{base_dir}/**/*.json', recursive=True)
    report = "AUDITORIA DE COLUNAS E URLS (SAAS WHITE-LABEL)\n\n"
    
    for file_path in sorted(json_files):
        report += f"\n{'='*60}\nFILE: {os.path.relpath(file_path, base_dir)}\n{'='*60}\n"
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            report += f"Error loading JSON: {e}\n"
            continue
            
        nodes = data.get('nodes', [])
        for node in nodes:
            node_type = node.get('type', '')
            node_name = node.get('name', 'Unknown')
            params = node.get('parameters', {})
            
            is_relevant = False
            msg = ""
            
            if 'supabase' in node_type.lower():
                is_relevant = True
                msg += f"[SUPABASE] Node: {node_name}\n"
                msg += f"  - Operation: {params.get('operation', 'N/A')}\n"
                msg += f"  - Table: {params.get('tableId', params.get('table', 'N/A'))}\n"
                
                # extracting fields
                fields_ui = params.get('fieldsUi', {}).get('fieldValues', [])
                if fields_ui:
                    fields = [f['fieldId'] for f in fields_ui]
                    msg += f"  - Form Fields: {fields}\n"
                if 'matchFields' in params:
                    msg += f"  - Match Fields: {params['matchFields']}\n"
            
            elif 'postgres' in node_type.lower():
                is_relevant = True
                msg += f"[POSTGRES] Node: {node_name}\n"
                op = params.get('operation', 'executeQuery')
                if op == 'executeQuery':
                    query = params.get('query', '')
                    if not query and 'options' in params and 'query' in params['options']:
                        query = params['options']['query']
                    msg += f"  - Query:\n    {query.strip() if isinstance(query, str) else query}\n"
                else:
                    schema_val = params.get('schema', {})
                    table_val = params.get('table', {})
                    if isinstance(table_val, dict): table_val = table_val.get('value', 'UNKNOWN')
                    if isinstance(schema_val, dict): schema_val = schema_val.get('value', 'public')
                    msg += f"  - Table: {schema_val}.{table_val}\n"
            
            elif 'httprequest' in node_type.lower():
                is_relevant = True
                url = str(params.get('url', ''))
                msg += f"[HTTP API] Node: {node_name}\n"
                msg += f"  - Method: {params.get('method', 'GET')}\n"
                if 'rsbcqkhbhmdieblogntv' in url:
                    msg += f"  - [WARNING] HARDCODED OLD SUPABASE URL: {url}\n"
                else:
                    msg += f"  - URL: {url}\n"
                    
            if is_relevant:
                report += msg + "-"*30 + "\n"

    print(report)

if __name__ == '__main__':
    audit_jsons()
