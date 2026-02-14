import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { getDataPath } from '../utils/helpers.js';
import { sessionManager } from '../core/session.js';

export function registerSessionsCommand(program: Command) {
  const cmd = program.command('sessions').description('Manage conversation sessions');

  cmd
    .command('list')
    .description('List sessions with last updated time')
    .action(() => {
      const sessions = sessionManager.listSessions();
      if (sessions.length === 0) {
        console.log('No sessions found.');
        return;
      }
      sessions.forEach((s) => {
        console.log(`${s.key}  updated: ${s.updatedAt}`);
      });
    });

  cmd
    .command('clear')
    .description('Clear all sessions (irreversible)')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (options) => {
      if (!options.yes) {
        console.log('This will delete all sessions stored in ./.nanobot/sessions. Re-run with --yes to confirm.');
        return;
      }
      const dir = path.join(getDataPath(), 'sessions');
      if (await fs.pathExists(dir)) {
        await fs.emptyDir(dir);
      }
      console.log('All sessions cleared.');
    });
}

