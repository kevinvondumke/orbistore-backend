import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['--test', 'integration/database.test.js'], {
    stdio: 'inherit', env: { ...process.env, RUN_DB_TESTS: '1' },
});
process.exitCode = result.status ?? 1;
