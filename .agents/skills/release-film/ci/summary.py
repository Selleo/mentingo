#!/usr/bin/env python3
"""The GitHub job summary of a film run (release-film.yml): the film, its scenes, the seat's limits the scene
workers used, the model use at API list prices (for sizing only: the seat pays) and the stage times. A run that
stopped early still gets its stages and cost.

    summary.py <run folder> >> "$GITHUB_STEP_SUMMARY"
"""
import json
from pathlib import Path
import subprocess
import sys

FILM = Path(__file__).resolve().parents[1] / 'scripts' / 'film.py'
STAGES = (('scenes', 'scenes'), ('review', 'review'), ('voice', 'voice'), ('render', 'render'), ('servers', 'test stack'))


ERRORS = []  # film.py commands that failed: shown in the summary, never read as "no film"


def film_py(command, run):
    done = subprocess.run([sys.executable, str(FILM), command, '--run', str(run)], capture_output=True, text=True)
    try:
        if done.returncode == 0:
            return json.loads(done.stdout)
    except ValueError:
        pass
    ERRORS.append(f"film.py {command}: {(done.stderr.strip().splitlines() or ['exit %d' % done.returncode])[-1][:200]}")
    return {}


def percent(value):
    return f'{round(value * 100)}%' if isinstance(value, (int, float)) else '?'


def lines(run, report, measured):
    rows = []
    film, scenes = measured.get('film') or {}, measured.get('scenes') or {}
    if film:
        chapters = len(measured.get('chapters') or [])
        rows.append(('Film', f"{film.get('seconds')} s, {chapters} chapters"))
    else:
        rows.append(('Film', 'none: see the run log'))
    if scenes:
        rows.append(('Scenes', f"{scenes.get('in_film')} of {scenes.get('chosen')} in the film "
                               f"({scenes.get('first_try')} on the first try, {scenes.get('tries')} tries)"))
    seat = report.get('seat') or {}
    if seat:
        names = {'five_hour': '5-hour window', 'seven_day': 'week'}
        rows.append(('Seat limits used by the scene workers', ', '.join(
            f"{names.get(name, name)} {percent(w.get('from'))} → {percent(w.get('to'))}" for name, w in seat.items())))
    cost = report.get('cost') or {}
    if cost.get('usd_known') is not None:
        rows.append(('Model use at API list prices (sizing only; the seat pays)',
                     f"${cost['usd_known']:.2f} (scenes ${cost.get('usd_scenes') or 0:.2f}, other calls "
                     f"${cost.get('usd_calls') or 0:.2f})"))
    stages = report.get('stages') or {}
    if stages.get('total'):
        parts = [f'{label} {stages[key] / 60:.1f} min' for key, label in STAGES if stages.get(key)]
        rows.append(('Time', f"{stages['total'] / 60:.1f} min: " + ', '.join(parts)))
    rows += [('Error', error.replace('|', '\\|')) for error in ERRORS]
    return [f'## Release film {run.parent.name}', '', '| | |', '|---|---|', *(f'| {a} | {b} |' for a, b in rows), '']


def main():
    run = Path(sys.argv[1])
    report = film_py('report', run)
    measured = film_py('metrics', run) if (run / 'story.json').is_file() else {}
    print('\n'.join(lines(run, report, measured)))


if __name__ == '__main__':
    main()
