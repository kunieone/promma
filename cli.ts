#!/usr/bin/env bun
import { initCommands } from './src/commands';

async function main() {
  try {
    const program = await initCommands();
    program.parse(process.argv);

    // 如果没有提供命令，显示帮助信息
    if (process.argv.length <= 2) {
      program.help();
    }
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

main(); 