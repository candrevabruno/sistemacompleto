import json
import glob
import os

def fix_all():
    base_dir = '/Users/elenmendes/Desktop/Heroic Leap - Sistema Completo/automacoes'
    json_files = glob.glob(f'{base_dir}/**/*.json', recursive=True)
    
    for file_path in json_files:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        modified = False
        nodes = data.get('nodes', [])
        
        # FIX 1: Replace old URLs with the new one
        old_host = 'rsbcqkhbhmdieblogntv.supabase.co'
        new_host = 'ignxshdfsstbuvxiqmju.supabase.co'
        
        for node in nodes:
            params = node.get('parameters', {})
            
            # HTTP Request URLs
            if 'httprequest' in node.get('type', '').lower():
                url = params.get('url', '')
                if isinstance(url, str) and old_host in url:
                    params['url'] = url.replace(old_host, new_host)
                    modified = True
                    
        # FIX 2: Follow Up 24h fixes
        if '2- Follow UP de 24 horas' in os.path.basename(file_path):
            for node in nodes:
                # 1. Update the 'verificarChatWoot' or 'If' node that checks follow_up_1 -> follow_up_2
                # Wait, the node checking it is actually named "If"
                if node.get('name') == 'If':
                    params = node.get('parameters', {})
                    conds_obj = params.get('conditions', {})
                    if isinstance(conds_obj, dict):
                        conds = conds_obj.get('conditions', [])
                        for c in conds:
                            left = c.get('leftValue', '')
                            if isinstance(left, str) and 'follow_up_1' in left:
                                c['leftValue'] = left.replace('follow_up_1', 'follow_up_2')
                                modified = True
                                
                # 2. Update the 'marcar_follow_up' Supabase update
                if node.get('name') == 'marcar_follow_up':
                    params = node.get('parameters', {})
                    fields_ui = params.get('fieldsUi', {})
                    if isinstance(fields_ui, dict):
                        field_vals = fields_ui.get('fieldValues', [])
                        for f in field_vals:
                            if f.get('fieldId') == 'follow_up_1':
                                f['fieldId'] = 'follow_up_2'
                                modified = True
                                
        # FIX 3: Follow Up 36h fixes
        if '3- Follow UP de 36 horas' in os.path.basename(file_path):
            for node in nodes:
                if node.get('name') == 'If':
                    params = node.get('parameters', {})
                    conds_obj = params.get('conditions', {})
                    if isinstance(conds_obj, dict):
                        conds = conds_obj.get('conditions', [])
                        for c in conds:
                            left = c.get('leftValue', '')
                            if isinstance(left, str) and 'follow_up_1' in left:
                                c['leftValue'] = left.replace('follow_up_1', 'follow_up_3')
                                modified = True
                                
                if node.get('name') == 'marcar_follow_up':
                    params = node.get('parameters', {})
                    fields_ui = params.get('fieldsUi', {})
                    if isinstance(fields_ui, dict):
                        field_vals = fields_ui.get('fieldValues', [])
                        for f in field_vals:
                            if f.get('fieldId') == 'follow_up_1':
                                f['fieldId'] = 'follow_up_3'
                                modified = True

        if modified:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"Fixed: {os.path.basename(file_path)}")

if __name__ == '__main__':
    fix_all()
