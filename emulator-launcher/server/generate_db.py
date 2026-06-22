import os
import json
import re

base_dir = 'REDACTED_PATH'
platforms = {
    'pcengine': {'id': 'pcengine', 'name': 'PC Engine', 'cmd': 'mednafen -video.fs 0 "{rom}"'},
    'tg16': {'id': 'tg16', 'name': 'TurboGrafx-16', 'cmd': 'mednafen -video.fs 0 "{rom}"'},
    'genesis': {'id': 'genesis', 'name': 'Sega Genesis', 'cmd': 'mednafen "{rom}"'},
    'sms': {'id': 'sms', 'name': 'Sega Master System', 'cmd': 'mednafen "{rom}"'},
    'nes': {'id': 'nes', 'name': 'NES', 'cmd': 'mednafen "{rom}"'},
    'dos': {'id': 'dos', 'name': 'DOSBox', 'cmd': 'cd "{dir}" && dosbox-staging -conf dosbox.conf'},
    'atari2600': {
        'id': 'atari2600',
        'name': 'Atari 2600',
        'cmd': '/Applications/Stella.app/Contents/MacOS/Stella -video metal -vsync 0 -threads 0 -audio.device 0 -audio.preset 1 -audio.sample_rate 48000 -audio.fragment_size 1024 -audio.resampling_quality 2 -audio.headroom 4 -audio.buffer_size 5 "{rom}"'
    },
    'atari5200': {'id': 'atari5200', 'name': 'Atari 5200', 'cmd': '/Applications/RetroArch.app/Contents/MacOS/RetroArch --appendconfig "REDACTED_PATH/emulator-launcher/retroarch_atari.cfg" -L "~/Library/Application Support/RetroArch/cores/a5200_libretro.dylib" "{rom}"'},
    'atari7800': {'id': 'atari7800', 'name': 'Atari 7800', 'cmd': '/Applications/RetroArch.app/Contents/MacOS/RetroArch --appendconfig "REDACTED_PATH/emulator-launcher/retroarch_7800.cfg" -L "~/Library/Application Support/RetroArch/cores/prosystem_libretro.dylib" "{rom}"'},
    'c64': {'id': 'c64', 'name': 'Commodore 64', 'cmd': 'open -a /Applications/VICE/x64sc.app "{rom}"'},
    'amiga': {'id': 'amiga', 'name': 'Amiga', 'cmd': 'fs-uae "{rom}"'},
    'atarist': {'id': 'atarist', 'name': 'Atari ST', 'cmd': 'hatari "{rom}"'}
}

games = []

tg16_categories = {}
tg_md = os.path.join(base_dir, 'TG16', 'TG16_Games_Categorized.md')
if os.path.exists(tg_md):
    current_cat = 'Uncategorized'
    with open(tg_md, 'r') as f:
        for line in f:
            if line.startswith('##'):
                current_cat = re.sub(r'[^a-zA-Z\s\/\'\-]', '', line.replace('##', '')).strip()
            elif line.startswith('- **'):
                match = re.search(r'\*\*(.*?)\*\*', line)
                if match:
                    title = match.group(1).split('(')[0].strip()
                    tg16_categories[title.lower()] = current_cat

def get_tg16_cat(filename):
    lower_f = filename.lower()
    for k, v in tg16_categories.items():
        if k in lower_f:
            return v
    return 'Uncategorized'

def get_pce_platform(filename):
    # TurboGrafx-16 was the North American release; everything else
    # (Japan, World, Hong Kong, etc.) ran on the PC Engine.
    return 'tg16' if '(USA)' in filename or '(USA,' in filename else 'pcengine'

def scan_files(directory, platform_id, is_dir=False):
    full_path = os.path.join(base_dir, directory)
    if not os.path.exists(full_path): return
    for item in os.listdir(full_path):
        if item.startswith('.'): continue
        item_path = os.path.join(full_path, item)
        if is_dir and os.path.isdir(item_path):
            games.append({
                'id': f"{platform_id}_{item.replace(' ', '_')}",
                'title': item,
                'platformId': platform_id,
                'category': 'MS-DOS Classics',
                'rom': item_path,
                'dir': item_path
            })
        elif not is_dir and os.path.isfile(item_path) and not item.endswith(('.md', '.sys', '.py', '.sh', '.txt', '.xml', '.sqlite', '.json', '.cfg', '.DS_Store', '.bin')):
            cat = 'Uncategorized'
            file_platform_id = platform_id
            if platform_id == 'tg16':
                cat = get_tg16_cat(item)
                file_platform_id = get_pce_platform(item)
            elif platform_id == 'genesis':
                cat = 'Sega Genesis'
            elif platform_id == 'sms':
                cat = 'Master System'
            elif platform_id == 'nes':
                cat = 'Nintendo'
            
            title = os.path.splitext(item)[0].split('(')[0].strip()
            item_id = f"{file_platform_id}_{os.path.splitext(item)[0].replace(' ', '_').replace('(', '').replace(')', '').replace(',', '')}"
            game = {
                'id': item_id,
                'title': title,
                'platformId': file_platform_id,
                'category': cat,
                'rom': item_path
            }
            if os.sep + 'CD-ROMs' + os.sep in item_path:
                game['isCD'] = True
            games.append(game)

scan_files('TG16/ROMs', 'tg16')
scan_files('TG16/CD-ROMs', 'tg16')
scan_files('Genesis/ROMs', 'genesis')
scan_files('SMS', 'sms')
scan_files('NES', 'nes')
scan_files('DOS', 'dos', is_dir=True)
scan_files('Atari2600/ROMs', 'atari2600')
scan_files('Atari5200/ROMs', 'atari5200')
scan_files('Atari7800/ROMs', 'atari7800')
scan_files('C64/ROMs', 'c64')
scan_files('Amiga/ROMs', 'amiga')
scan_files('AtariST/ROMs', 'atarist')

with open(os.path.join(base_dir, 'emulator-launcher', 'server', 'database.json'), 'w') as f:
    json.dump({'platforms': list(platforms.values()), 'games': games}, f, indent=2)

print(f"Generated database with {len(games)} games.")
