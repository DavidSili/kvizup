"""Isolated PHP HTTP integration checks; never writes real lesson files or keys."""
import argparse
import copy
import http.cookiejar
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--php', default='php')
args = parser.parse_args()
project = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='kvizup-admin-test-') as folder:
    folder = Path(folder)
    shutil.copytree(project / 'admin', folder / 'admin')
    (folder / 'data/subjects').mkdir(parents=True)
    fixture = {'id': 'test', 'title': 'Test predmet', 'chapters': [
        {'id': 'lesson', 'title': 'Lekcija', 'items': [{'id': 'card', 'question': 'Pitanje', 'answer': 'Odgovor'}],
         'questions': [{'id': 'quiz', 'prompt': 'Pitanje', 'answer': 'Da', 'choices': ['Da', 'Ne']}],
         'activities': [{'id': 'cards', 'type': 'flashcards', 'title': 'Kartice', 'itemSet': 'items'},
                        {'id': 'quiz', 'type': 'choice-quiz', 'title': 'Test', 'itemSet': 'questions'}]}]}
    (folder / 'data/subjects/test.json').write_text(json.dumps(fixture), encoding='utf-8')
    hashing = folder / 'hash.php'
    hashing.write_text('<?php echo password_hash(trim(stream_get_contents(STDIN)), PASSWORD_DEFAULT);')
    password = 'integration-only-password'
    hashed = subprocess.check_output([args.php, str(hashing)], input=password, text=True).strip()
    (folder / '.env').write_text(f'ADMIN_SARA_PASSWORD_HASH={hashed}\nADMIN_DAVID_PASSWORD_HASH={hashed}\nOPENAI_API_KEY=\nKVIZUP_PRIVATE_DIR={folder.as_posix()}/private\n')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    environment = os.environ.copy()
    for key in ['ADMIN_SARA_PASSWORD_HASH', 'ADMIN_DAVID_PASSWORD_HASH', 'KVIZUP_PRIVATE_DIR', 'OPENAI_API_KEY']:
        environment.pop(key, None)
    server = subprocess.Popen([args.php, '-S', f'127.0.0.1:{port}', '-t', str(folder)],
                              env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    csrf = ''
    def request(action, body=None, token=None):
        headers = {}
        if body is not None:
            headers = {'Content-Type': 'application/json', 'X-CSRF-Token': csrf if token is None else token}
        req = urllib.request.Request(f'http://127.0.0.1:{port}/admin/api.php?action={action}',
                                     data=json.dumps(body).encode() if body is not None else None, headers=headers)
        try:
            response = opener.open(req)
        except urllib.error.HTTPError as error:
            response = error
        return response.status, json.loads(response.read())
    try:
        for _ in range(50):
            try:
                status, session = request('session')
                break
            except urllib.error.URLError:
                time.sleep(.1)
        assert not session['user']
        csrf = session['csrf']
        assert request('subjects')[0] == 401
        assert request('login', {'username': 'sara', 'password': password}, token='wrong')[0] == 403
        assert request('login', {'username': 'unknown', 'password': password})[0] == 401
        status, session = request('login', {'username': 'sara', 'password': password})
        assert status == 200 and session['user'] == 'sara'
        csrf = session['csrf']
        status, data = request('subjects')
        revision = data['subjects'][0]['revision']
        changed = copy.deepcopy(fixture)
        changed['title'] = 'Izmenjeno'
        assert request('save', {'id': '../bad', 'subject': changed, 'revision': revision})[0] == 400
        invalid = copy.deepcopy(changed)
        invalid['chapters'][0]['questions'][0]['answer'] = 'Not in choices'
        assert request('save', {'id': 'test', 'subject': invalid, 'revision': revision})[0] == 400
        invalid = copy.deepcopy(changed)
        invalid['chapters'][0]['imageDirectory'] = 'assets/images/../../admin'
        assert request('save', {'id': 'test', 'subject': invalid, 'revision': revision})[0] == 400
        status, saved = request('save', {'id': 'test', 'subject': changed, 'revision': revision})
        assert status == 200
        assert request('save', {'id': 'test', 'subject': fixture, 'revision': revision})[0] == 409
        assert request('delete', {'id': 'test', 'revision': revision})[0] == 409
        assert json.loads((folder / 'data/subjects/test.json').read_text())['title'] == 'Izmenjeno'
        assert list((folder / 'private/backups').iterdir())
        assert request('generate', {})[0] == 503
        new = copy.deepcopy(fixture)
        new['id'] = 'new'
        status, created = request('save', {'id': 'new', 'subject': new, 'revision': None})
        assert status == 200
        assert request('save', {'id': 'new', 'subject': new, 'revision': None})[0] == 409
        assert request('delete', {'id': 'new', 'revision': created['revision']})[0] == 200
        assert not (folder / 'data/subjects/new.json').exists()
        assert request('logout', {})[0] == 200
        assert request('subjects')[0] == 401
        _, session = request('session')
        csrf = session['csrf']
        status, session = request('login', {'username': 'david', 'password': password})
        assert status == 200 and session['user'] == 'david'
        # Validate all existing production lessons without changing them.
        validation = folder / 'validate.php'
        validation.write_text('<?php require ' + json.dumps(str(project / 'admin/lib.php').replace('\\', '/')) +
                              '; foreach (glob(' + json.dumps(str(project / 'data/subjects/*.json').replace('\\', '/')) +
                              ') as $file) { validate_subject(json_decode(file_get_contents($file), true)); } echo "Existing subjects valid";')
        subprocess.run([args.php, str(validation)], check=True)
        ai_check = folder / 'ai-check.php'
        ai_check.write_text('<?php require ' + json.dumps(str(project / 'admin/lib.php').replace('\\', '/')) +
                            '; require ' + json.dumps(str(project / 'admin/ai.php').replace('\\', '/')) + ';\n' + '''
$proposal = ['description'=>'Opis','cards'=>[['question'=>'Pitanje','answer'=>'Odgovor','description'=>'Objasnjenje']],
 'questions'=>[['prompt'=>'Pitanje','answer'=>'Da','choices'=>['Da','Ne','Mozda']]],'warnings'=>['Proveri'],
 'corrections'=>[['original'=>'Godina 1803','corrected'=>'Godina 1804','reason'=>'Ispravljena godina dogadjaja']]];
$result = proposal_to_chapter($proposal, 'lesson', 'Lekcija', ['flashcards','text-quiz','choice-quiz']);
assert(count($result['chapter']['activities']) === 2);
assert(count($result['warnings']) === 2);
assert($result['corrections'] === $proposal['corrections']);
assert(in_array('Da', $result['chapter']['questions'][0]['choices'], true));
validate_subject(['id'=>'test','title'=>'Test','chapters'=>[$result['chapter']]]);
$multi = $proposal;
$multi['cards'] = [];
foreach (['Ratovi','Politika'] as $topic) foreach (['Napoleon','Francuska','Konzulat'] as $answer) $multi['cards'][] = ['topic'=>$topic,'textSuitable'=>true,'question'=>'Ko?', 'answer'=>$answer,'description'=>''];
$multi['cards'][] = ['topic'=>'Ratovi','textSuitable'=>true,'question'=>'Objasni', 'answer'=>'Ovo je cela recenica koju ne treba unositi.', 'description'=>''];
$multi['questions'][0]['topic'] = 'Ratovi';
$multi['questions'][] = ['topic'=>'Politika','prompt'=>'Ko?', 'answer'=>'Da','choices'=>['Da','Ne','Mozda']];
$grouped = proposal_to_chapter($multi, 'lesson', 'Lekcija', ['flashcards','choice-quiz','text-quiz']);
assert(count($grouped['chapter']['activities']) === 6);
foreach ($grouped['chapter']['activities'] as $a) {
 assert(isset($a['itemIds']));
 if ($a['type'] === 'text-quiz') assert(count($a['itemIds']) === 3);
}
$broken = $grouped['chapter'];
$broken['activities'][0]['itemIds'] = ['missing'];
try { validate_subject(['id'=>'test','title'=>'Test','chapters'=>[$broken]]); throw new RuntimeException('Missing item ID accepted'); } catch (InvalidArgumentException $expected) {}
$proposal['questions'][0]['answer'] = 'Missing';
try { proposal_to_chapter($proposal, 'lesson', 'Lekcija', ['choice-quiz']); throw new RuntimeException('Invalid AI answer accepted'); }
catch (InvalidArgumentException $expected) {}
$schema=ai_schema();
assert($schema['additionalProperties'] === false);
assert(in_array('corrections', $schema['required'], true));
assert($schema['properties']['corrections']['items']['required'] === ['original','corrected','reason']);
echo "AI proposal conversion valid";
''')
        subprocess.run([args.php, '-d', 'zend.assertions=1', '-d', 'assert.exception=1', str(ai_check)], check=True)
        # Reject a forged image before making an OpenAI request.
        env = folder / '.env'
        env.write_text(env.read_text().replace('OPENAI_API_KEY=\n', 'OPENAI_API_KEY=test-not-real\n'))
        csrf = session['csrf']
        boundary = 'kvizup-test-boundary'
        fields = {'instructions': 'Test', 'title': 'Test', 'id': 'lesson', 'types': '["flashcards"]'}
        multipart = ''.join(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n' for key,value in fields.items())
        multipart += f'--{boundary}\r\nContent-Disposition: form-data; name="images[]"; filename="photo.jpg"\r\nContent-Type: image/jpeg\r\n\r\nnot-an-image\r\n--{boundary}--\r\n'
        req = urllib.request.Request(f'http://127.0.0.1:{port}/admin/api.php?action=generate', data=multipart.encode(),
            headers={'Content-Type': 'multipart/form-data; boundary='+boundary, 'X-CSRF-Token':csrf})
        try: response=opener.open(req)
        except urllib.error.HTTPError as error: response=error
        assert response.status == 400, response.read()
        print('\nPASS: auth, CSRF, both accounts, validation, CRUD, conflicts, backups, AI conversion and invalid upload rejection.')
    finally:
        server.terminate()
        server.wait(timeout=5)
