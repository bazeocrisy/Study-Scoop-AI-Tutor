# Curriculum is reviewed directly in JSON. Do not regenerate it from a second copy.
import json
from pathlib import Path
lesson = json.loads((Path(__file__).resolve().parent.parent / 'curriculum/6-1.json').read_text())
assert lesson['id'] == '6-1'
assert len(lesson['concepts']) == 9
assert len(lesson['assessment']) == 8
for concept in lesson['concepts']:
 assert concept['example']['visual']
 if concept['check']['kind'] == 'reason':
  assert concept['followUp']['answer'] in concept['followUp']['options']
print('Reviewed curriculum structure validated; no files overwritten.')
