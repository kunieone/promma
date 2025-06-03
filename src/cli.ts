#!/usr/bin/env bun

import { initCommands } from './commands';

async function main() {
  try {
    const program = await initCommands();
    program.parse(process.argv);
  } catch (error) {
    console.error('程序运行出错:', error);
    process.exit(1);
  }
}

main(); 