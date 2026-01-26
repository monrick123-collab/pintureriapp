import zipfile
import sys
import re

file_path = '/home/fergus/Descargas/pintureriapp-main/Perfiles/MANUAL DE FUNCIONES OPERATIVO Y DETALLADO (1).docx'

try:
    with zipfile.ZipFile(file_path, 'r') as z:
        if 'word/document.xml' in z.namelist():
            xml_content = z.read('word/document.xml').decode('utf-8')
            # Simple regex to remove tags
            text = re.sub('<[^>]+>', ' ', xml_content)
            with open('extracted_text.txt', 'w') as f:
                f.write(text)
        else:
            with open('extracted_text.txt', 'w') as f:
                f.write("word/document.xml not found")
except Exception as e:
    with open('extracted_text.txt', 'w') as f:
        f.write(f"Error: {e}")

