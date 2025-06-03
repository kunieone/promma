#!/usr/bin/env bun

console.log('提示词管理器 - 一个命令行工具');
console.log('请使用以下命令运行:');
console.log('  bun run cli.ts');
console.log('或导入示例数据:');
console.log('  bun run example.ts');
console.log('\n更多信息请查看 README.md');

// 自动重定向到帮助
import('./cli');