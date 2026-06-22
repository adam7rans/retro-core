#!/usr/bin/env python3
"""Download box art (libretro-thumbnails) for Genesis, Master System and DOS
games into client/public/art/<platformId>/<gameId>.png so the launcher can
display the covers in the cards."""

import json
import os
import urllib.parse
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(BASE, 'database.json')
ART_ROOT = os.path.join(BASE, '..', 'client', 'public', 'art')

REPO = 'https://raw.githubusercontent.com/libretro-thumbnails/{repo}/master/Named_Boxarts/{name}.png'

REPOS = {
    'genesis': 'Sega_-_Mega_Drive_-_Genesis',
    'sms': 'Sega_-_Master_System_-_Mark_III',
    'dos': 'DOS',
}

# libretro replaces these filesystem-unsafe chars with '_'
ILLEGAL = '&*/:`<>?\\|"'


def libretro_name(name):
    return ''.join('_' if c in ILLEGAL else c for c in name)


def boxart_name_from_rom(rom_path):
    """No-Intro boxart name = url-decoded rom filename without extension."""
    base = os.path.basename(rom_path)
    base = urllib.parse.unquote(base)
    return os.path.splitext(base)[0]


# Explicit overrides where the rom name doesn't match a thumbnail name.
GENESIS_NAMES = {
    'genesis_Mortal_Kombat_USA_Europe_Rev_A_Beta': 'Mortal Kombat (World)',
    'genesis_Sonic_The_Hedgehog_2_USA_Europe_Rev_A_Virtual_Console':
        'Sonic The Hedgehog 2 (World)',
}

SMS_NAMES = {
    'sms_Fantasy_Zone': 'Fantasy Zone (World) (Rev 1)',
    'sms_Fantasy%20Zone%20%28World%29%20%28Rev%201%29': 'Fantasy Zone (World) (Rev 1)',
}

DOS_NAMES = {
    'dos_Carmageddon': 'Carmageddon Max Pack (1998)',
    'dos_KingsQuest': "King's Quest",
    'dos_PoliceQuest': 'Police Quest 1 - In Pursuit of the Death Angel VGA (1990)',
    'dos_Populous': 'Populous (1989)',
    'dos_Stunts': 'Stunts (1990)',
    'dos_TestDrive': 'Test Drive (1987)',
    'dos_TestDrive3': 'Test Drive III The Passion (1990)',
    'dos_Ultima7': 'Ultima VII Part 1 - The Black Gate + Forge of Virtue (1992)',
    'dos_WillyBeamish': 'Adventures of Willy Beamish, The (1991)',
    'dos_Wolfenstein3D': 'Wolfenstein 3D (1992)',
}


def download(repo_key, name, dest):
    url = REPO.format(repo=REPOS[repo_key],
                      name=urllib.parse.quote(libretro_name(name)))
    req = urllib.request.Request(url, headers={'User-Agent': 'curl/8'})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    with open(dest, 'wb') as f:
        f.write(data)
    return len(data)


def main():
    db = json.load(open(DB))
    ok = fail = skip = 0
    for game in db['games']:
        pid = game['platformId']
        if pid not in ('genesis', 'sms', 'dos'):
            continue

        if pid == 'genesis':
            name = GENESIS_NAMES.get(game['id']) or boxart_name_from_rom(game['rom'])
        elif pid == 'sms':
            name = SMS_NAMES.get(game['id'])
        else:
            name = DOS_NAMES.get(game['id'])

        if not name:
            print(f'  ?  no mapping for {game["id"]}')
            fail += 1
            continue

        dest_dir = os.path.join(ART_ROOT, pid)
        os.makedirs(dest_dir, exist_ok=True)
        dest = os.path.join(dest_dir, game['id'] + '.png')
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            skip += 1
            continue
        try:
            size = download(pid, name, dest)
            print(f'  OK {pid:8} {game["title"][:40]:40} {size//1024}KB')
            ok += 1
        except Exception as e:
            print(f'  XX {pid:8} {game["title"][:40]:40} -> "{name}" ({e})')
            if os.path.exists(dest):
                os.remove(dest)
            fail += 1

    print(f'\nDone: {ok} downloaded, {skip} skipped, {fail} failed')


if __name__ == '__main__':
    main()
