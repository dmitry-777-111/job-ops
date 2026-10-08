#!/usr/bin/env python3
"""Restricted SSH entry point for the freeze3 test service only."""
import fcntl
import http.client
import json
import os
from pathlib import Path
import re
import signal
import socket
import subprocess
import sys
import tempfile
import time

ROOT = Path('/opt/career-os-ci')
DATA = Path('/opt/career-os-next/f3-user-test-0e42e827/data')
IMAGE = 'ghcr.io/dmitry-777-111/job-ops-freeze3'

class DockerConnection(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(120)
        self.sock.connect('/var/run/docker.sock')

def api(method, path, body=None):
    conn = DockerConnection('localhost')
    conn.request(method, '/v1.44' + path, None if body is None else json.dumps(body),
                 {'Content-Type': 'application/json'})
    response = conn.getresponse()
    raw = response.read()
    if response.status >= 400:
        raise RuntimeError('Docker request failed: HTTP ' + str(response.status))
    return json.loads(raw) if raw else None

def save(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value))
    temporary.chmod(0o600)
    temporary.replace(path)

def healthy(name):
    for _ in range(60):
        state = api('GET', '/containers/' + name + '/json')['State']
        if not state['Running']:
            return False
        if state.get('Health', {}).get('Status') == 'healthy':
            return True
        time.sleep(3)
    return False

def restore(record):
    api('POST', '/containers/' + record['new'] + '/stop?t=30')
    # Retain the failed data as a separate directory for investigation.
    failed = DATA.with_name('data-before-rollback-' + record['id'])
    if failed.exists():
        raise RuntimeError('Rollback data destination already exists')
    DATA.rename(failed)
    DATA.mkdir(mode=0o700)
    subprocess.run(['tar', '-xpf', record['backup'], '-C', str(DATA)], check=True)
    api('POST', '/containers/' + record['old'] + '/start')
    if not healthy(record['old']):
        raise RuntimeError('Previous container requires operator attention')
    save(ROOT / 'current.json', {'container': record['old']})
    record['status'] = 'rolled_back'
    save(ROOT / 'last-deploy.json', record)
    print('ROLLBACK_OK previous container and data restored', flush=True)

def deploy(digest, revision):
    token = sys.stdin.read(8192).strip()
    if not token or len(token) > 4096:
        raise RuntimeError('Missing registry credential')
    image = IMAGE + '@' + digest
    with tempfile.TemporaryDirectory(prefix='registry-', dir=ROOT) as config:
        env = dict(os.environ, DOCKER_CONFIG=config)
        result = subprocess.run(['docker', 'login', 'ghcr.io', '-u', 'dmitry-777-111',
                                 '--password-stdin'], input=token, text=True,
                                capture_output=True, env=env)
        token = None
        if result.returncode:
            raise RuntimeError('Registry login failed')
        result = subprocess.run(['docker', 'pull', image], capture_output=True, env=env)
        if result.returncode:
            raise RuntimeError('Image pull failed; current service untouched')
    print('IMAGE_READY ' + revision, flush=True)
    old = json.loads((ROOT / 'current.json').read_text())['container']
    spec = api('GET', '/containers/' + old + '/json')
    ident = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()) + '-' + revision[:8]
    new = 'career-os-ci-' + ident.lower()
    backup = ROOT / 'backups' / ident
    backup.mkdir(mode=0o700, parents=True)
    save(backup / 'container.json', spec)
    record = {'id': ident, 'old': old, 'new': new, 'image': image,
              'revision': revision, 'backup': str(backup / 'data.tar'), 'status': 'preparing'}
    config = dict(spec['Config'])
    config.update(Image=image, Hostname='', Labels={**(config.get('Labels') or {}),
                  'career-os.revision': revision, 'career-os.managed': 'github-actions'})
    config['HostConfig'] = spec['HostConfig']
    api('POST', '/containers/create?name=' + new, config)
    api('POST', '/containers/' + old + '/stop?t=45')
    try:
        subprocess.run(['tar', '-cpf', record['backup'], '-C', str(DATA), '.'], check=True)
    except BaseException:
        api('POST', '/containers/' + old + '/start')
        raise
    record['status'] = 'deploying'
    save(ROOT / 'last-deploy.json', record)
    try:
        api('POST', '/containers/' + new + '/start')
        if not healthy(new):
            raise RuntimeError('New container failed health check')
        save(ROOT / 'current.json', {'container': new})
        record['status'] = 'healthy'
        save(ROOT / 'last-deploy.json', record)
    except BaseException:
        restore(record)
        raise
    print('DEPLOY_OK ' + revision + ' health=healthy rollback=' + old, flush=True)

def main():
    os.umask(0o077)
    signal.signal(signal.SIGHUP, signal.SIG_IGN)
    command = os.environ.get('SSH_ORIGINAL_COMMAND', '').split()
    with (ROOT / 'deploy.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if command == ['status']:
            current = json.loads((ROOT / 'current.json').read_text())
            state = api('GET', '/containers/' + current['container'] + '/json')['State']
            print(json.dumps({'container': current['container'], 'running': state['Running'],
                              'health': state.get('Health', {}).get('Status')}))
        elif command == ['rollback']:
            record = json.loads((ROOT / 'last-deploy.json').read_text())
            if record['status'] != 'healthy':
                raise RuntimeError('No completed deployment available to roll back')
            restore(record)
        elif (len(command) == 3 and command[0] == 'deploy'
              and re.fullmatch(r'sha256:[a-f0-9]{64}', command[1])
              and re.fullmatch(r'[a-f0-9]{40}', command[2])):
            deploy(command[1], command[2])
        else:
            raise RuntimeError('Only deploy, rollback and status are allowed')

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # No raw Docker configuration, environment or registry output in logs.
        print('DEPLOY_ERROR ' + str(error), file=sys.stderr)
        sys.exit(1)
