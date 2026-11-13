import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute = promisify(execFile);

export class SlackAdapter {
  constructor(helper) { this.helper = helper; }

  async run(...args) {
    const {stdout} = await execute(this.helper, args, {timeout: 4000, maxBuffer: 16384});
    const result = JSON.parse(stdout);
    if (result.error) throw new Error(result.error);
    return result;
  }

  status() { return this.run('status'); }
  toggle(target, kind) { return this.run('toggle', kind, target[kind]); }
}
