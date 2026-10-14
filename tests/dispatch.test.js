import { describe, it, expect, vi } from 'vitest';
import { dispatch } from '../src/terminal/dispatch.js';
import { builtins } from '../src/terminal/builtins.js';
import { tdCommandSet, HELP_FOOTER } from '../src/todoist/commands.js';

function makeEnv(api = {}) {
  return {
    commandSet: tdCommandSet,
    builtins,
    ctx: { api, knownTasks: [], helpFooter: HELP_FOOTER },
  };
}

describe('dispatch: built-ins', () => {
  it('does nothing for empty input', async () => {
    expect(await dispatch('   ', makeEnv())).toEqual({ type: 'none' });
  });

  it('cls clears the screen', async () => {
    expect(await dispatch('cls', makeEnv())).toEqual({ type: 'clear' });
  });

  it('built-ins are case-insensitive, like DOS', async () => {
    expect(await dispatch('CLS', makeEnv())).toEqual({ type: 'clear' });
  });

  it('help lists built-ins and points to td --help', async () => {
    const result = await dispatch('help', makeEnv());
    expect(result.type).toBe('lines');
    const text = result.lines.join('\n');
    expect(text).toContain('cls');
    expect(text).toContain('mode expert|normal');
    expect(result.lines.at(-1)).toBe('Type td --help for Todoist commands.');
  });

  it('mode expert / mode normal toggle expert mode', async () => {
    expect(await dispatch('mode expert', makeEnv())).toEqual({ type: 'setMode', expert: true });
    expect(await dispatch('mode normal', makeEnv())).toEqual({ type: 'setMode', expert: false });
  });

  it('mode with a bad argument shows usage', async () => {
    const result = await dispatch('mode turbo', makeEnv());
    expect(result).toMatchObject({ type: 'message', tone: 'error' });
    expect(result.text).toContain('Usage: mode');
  });

  it('unknown input is a bad command', async () => {
    expect(await dispatch('dir /w', makeEnv())).toEqual({
      type: 'message',
      tone: 'error',
      text: 'Bad command or file name',
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
      actions: [{ label: 'DONE', command: 'td task complete id:1' }],
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
