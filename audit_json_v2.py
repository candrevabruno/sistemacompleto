import json
import os
import glob

def audit_jsons():
    base_dir = '/Users/elenmendes/Desktop/Heroic Leap - Sistema Completo/automacoes'
    json_files = glob.glob(f'{base_dir}/**/*.json', recursive=True)
    report = ""
    
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
            
            elif 'postgres' in node_type.lower():
                is_relevant = True
                msg += f"[POSTGRES] Node: {node_name}\n"
                op = params.get('operation', 'executeQuery')
                msg += f"  - Operation: {op}\n"
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
                msg += f"  - URL: {url}\n"
                
            elif 'agent' in node_type.lower() or 'chat' in node_type.lower() or 'langchain' in node_type.lower():
                text = str(params.get('text', ''))
                options = params.get('options', {})
                system_message = str(options.get('systemMessage', ''))
                if 'paciente' in system_message.lower() or 'paciente' in text.lower() or 'clinica' in system_message.lower() or "clínica" in system_message.lower():
                    is_relevant = True
                    msg += f"[PROMPT WARNING] Node: {node_name}\n"
                    msg += f"  - Found terms related to 'clinica/paciente' in the prompt/system message.\n"
                    
            if is_relevant:
                report += msg + "-"*30 + "\n"

    print(report)

if __name__ == '__main__':
    audit_jsons()
