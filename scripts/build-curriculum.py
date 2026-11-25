# Curriculum is reviewed directly in JSON. Do not regenerate it from a second copy.
# Quick structural check of every registered lesson. The authoritative schema check is
# `npm run validate` (scripts/validate-curriculum.mjs), which the browser and Worker also apply.
import json
from pathlib import Path
root = Path(__file__).resolve().parent.parent / 'curriculum'
registry = json.loads((root / 'registry.json').read_text())
assert registry['schemaVersion'] == 1
assert registry['default'] in [l['id'] for l in registry['lessons']]
for entry in registry['lessons']:
    lesson = json.loads((root / entry['file']).read_text())
    assert lesson['id'] == entry['id'] and lesson['schemaVersion'] == 1
    assert lesson['concepts'] and lesson['assessment']
    ids = [c['id'] for c in lesson['concepts']]
    assert len(set(ids)) == len(ids)
    for concept in lesson['concepts']:
        assert concept['example']['visual']
        assert all(r in ids[:ids.index(concept['id'])] for r in concept.get('requires', []))
        if concept['check']['kind'] == 'reason':
            assert concept['followUp']['answer'] in concept['followUp']['options']
    print(f"{entry['id']}: {len(lesson['concepts'])} concepts, {len(lesson['assessment'])} assessment items")
print('Reviewed curriculum structure validated; no files overwritten.')
