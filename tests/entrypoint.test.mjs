import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const source = fs.readFileSync(new URL('../docker-entrypoint.sh', import.meta.url), 'utf8');
function boot(overrides = {}) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'airflow-entrypoint-'));
    try {
        const id = path.join(temp, 'id');
        fs.writeFileSync(id, '#!/bin/sh\necho 50000\n', {mode: 0o755});
        const capture = path.join(temp, 'capture');
        fs.writeFileSync(capture, '#!/bin/sh\nprintf "%s\\n" "$AIRFLOW__CORE__EXECUTOR" "$AIRFLOW__DATABASE__SQL_ALCHEMY_CONN" "$AIRFLOW__API__PORT" "$*"\n', {mode: 0o755});
        const entrypoint = path.join(temp, 'entrypoint.sh');
        fs.writeFileSync(entrypoint, source.replaceAll('/opt/airflow/data', path.join(temp, 'data')).replace('exec /entrypoint airflow standalone', `exec "${capture}" airflow standalone`));
        const env = {...process.env, PATH: `${temp}:${process.env.PATH}`, PORT: '8096'};
        for (const key of Object.keys(env)) if (key.startsWith('AIRFLOW_') || key.startsWith('_AIRFLOW_')) delete env[key];
        return execFileSync('bash', [entrypoint], {env: {...env, ...overrides}, encoding: 'utf8'}).trim().split('\n');
    } finally {
        fs.rmSync(temp, {recursive: true, force: true});
    }
}
test('standalone defaults to the Airflow 3 executor and forwards the Railway port', () => {
    const result = boot();
    assert.equal(result[0], 'LocalExecutor');
    assert.match(result[1], /^sqlite:\/\/\/\/.+\/data\/airflow.db$/);
    assert.equal(result[2], '8096');
    assert.equal(result[3], 'airflow standalone');
});
test('an explicit executor and external database remain configured', () => {
    const result = boot({AIRFLOW__CORE__EXECUTOR: 'CeleryExecutor', AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: 'postgresql+psycopg2://test/db', AIRFLOW__API__PORT: '9000'});
    assert.equal(result[0], 'CeleryExecutor');
    assert.equal(result[1], 'postgresql+psycopg2://test/db');
    assert.equal(result[2], '9000');
});
