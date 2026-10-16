import { describe, it, expect, vi } from 'vitest';
import { dispatch } from '../src/terminal/dispatch.js';
import { builtins } from '../src/terminal/builtins.js';
import { tdCommandSet, HELP_FOOTER } from '../src/todoist/commands.js';

function makeEnv(api = {}) {
  return {
    commandSet: tdCommandSet,
    builtins,
    ctx: { api: { hasToken: true, ...api }, knownTasks: [], helpFooter: HELP_FOOTER },
  };
}

describe('dispatch: built-ins', () => {
  it('does nothing for empty input', async () => {
    expect(await dispatch('   ', makeEnv())).toEqual({ type: 'none' });
  });

  it('clear clears the screen', async () => {
    expect(await dispatch('clear', makeEnv())).toEqual({ type: 'clear' });
  });

  it('built-ins are case-insensitive', async () => {
    expect(await dispatch('CLEAR', makeEnv())).toEqual({ type: 'clear' });
    expect(await dispatch('EXPERT ON', makeEnv())).toEqual({ type: 'setMode', expert: true });
  });

  it('cls is gone', async () => {
    expect(await dispatch('cls', makeEnv())).toMatchObject({ type: 'message', tone: 'error' });
  });

  it('help lists built-ins and points to td --help', async () => {
    const result = await dispatch('help', makeEnv());
    expect(result.type).toBe('lines');
    const text = result.lines.join('\n');
    expect(text).toContain('clear');
    expect(text).toContain('expert on|off');
    expect(text).not.toContain('cls');
    expect(text).not.toContain('mode');
    expect(result.lines.at(-1)).toBe('Type td --help for Todoist commands.');
  });

  it('expert on / expert off toggle expert mode', async () => {
    expect(await dispatch('expert on', makeEnv())).toEqual({ type: 'setMode', expert: true });
    expect(await dispatch('expert off', makeEnv())).toEqual({ type: 'setMode', expert: false });
  });

  it('expert with a bad argument shows usage', async () => {
    const result = await dispatch('expert turbo', makeEnv());
    expect(result).toMatchObject({ type: 'message', tone: 'error' });
    expect(result.text).toBe('Usage: expert on|off');
  });

  it('unknown input names the first word, parser style', async () => {
    expect(await dispatch('xyzzy plugh', makeEnv())).toEqual({
      type: 'message',
      tone: 'error',
      text: 'I don\'t understand "xyzzy". Type help for commands.',
    });
  });
});

describe('dispatch: td', () => {
  it.each(['td', 'td --help', 'td -h', 'td help'])('%s shows td help', async (line) => {
    const result = await dispatch(line, makeEnv());
    expect(result.type).toBe('lines');
    expect(result.lines[0]).toBe('Usage: td [options] [command]');
    const text = result.lines.join('\n');
    expect(text).toContain('Options:');
    expect(text).toContain('Commands:');
    expect(text).toContain('task complete <ref>');
    expect(text).toContain('The real td CLI has many more commands');
  });

  it('td --help lists auth', async () => {
    const result = await dispatch('td --help', makeEnv());
    expect(result.lines.join('\n')).toMatch(/auth <command>\s+Manage authentication/);
  });

  it.each(['td auth', 'td auth --help', 'td help auth'])('%s lists the auth subcommands', async (line) => {
    const result = await dispatch(line, makeEnv());
    expect(result.lines[0]).toBe('Usage: td auth [options] [command]');
    const text = result.lines.join('\n');
    for (const sub of ['login', 'logout', 'status', 'token <token>']) expect(text).toContain(sub);
  });

  it('td auth token --help shows usage for auth token', async () => {
    const result = await dispatch('td auth token --help', makeEnv());
    expect(result.lines[0]).toBe('Usage: td auth token "<token>"');
  });

  it('td add --help shows usage for add', async () => {
    const result = await dispatch('td add --help', makeEnv());
    expect(result.lines[0]).toBe('Usage: td add "<text>"');
  });

  it('unknown td subcommand is an error', async () => {
    const result = await dispatch('td upcoming', makeEnv());
    expect(result).toMatchObject({ type: 'message', tone: 'error' });
    expect(result.text).toContain('td upcoming');
  });

  it('td today calls the API and returns an item list', async () => {
    const api = {
      getTodayTasks: vi.fn().mockResolvedValue([
        { id: '1', content: 'Water plants', priority: 4, due: { date: '2099-01-01', string: 'today' } },
      ]),
    };
    const result = await dispatch('td today', makeEnv(api));
    expect(result.type).toBe('itemList');
    expect(result.items[0]).toMatchObject({
      text: 'Water plants',
      mark: '!!!',
      checkCommand: 'td task complete id:1',
      ref: 'id:1',
    });
  });

  it('td add passes quoted text to quick add', async () => {
    const api = { quickAdd: vi.fn().mockResolvedValue({ id: '9', content: 'Buy milk', due: null }) };
    const result = await dispatch('td add "Buy milk tomorrow p1"', makeEnv(api));
    expect(api.quickAdd).toHaveBeenCalledWith('Buy milk tomorrow p1');
    expect(result).toMatchObject({ type: 'message', tone: 'success' });
  });

  it('td add with empty text shows usage and does not call the API', async () => {
    const api = { quickAdd: vi.fn() };
    const result = await dispatch('td add ""', makeEnv(api));
    expect(result.text).toBe('Usage: td add "<text>"');
    expect(api.quickAdd).not.toHaveBeenCalled();
  });
});
