import type { Prompt } from '../models/promptModel';
import { layout } from './layout';

// 生成提示词卡片
const promptCard = (prompt: Prompt) => `
  <div class="col">
    <div class="card h-100 shadow-sm">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="card-title mb-0">${prompt.title}</h5>
        <span class="badge bg-secondary">${prompt.category || '未分类'}</span>
      </div>
      <div class="card-body">
        <div class="card-text prompt-content-preview">${prompt.content.substring(0, 150)}${prompt.content.length > 150 ? '...' : ''}</div>
      </div>
      <div class="card-footer d-flex justify-content-between align-items-center">
        <small class="text-muted">更新于: ${new Date(prompt.updated_at || '').toLocaleString()}</small>
        <div class="btn-group">
          <a href="/view/${prompt.id}" class="btn btn-sm btn-outline-primary">查看</a>
          <a href="/edit/${prompt.id}" class="btn btn-sm btn-outline-secondary">编辑</a>
          <button class="btn btn-sm btn-outline-danger" onclick="deletePrompt(${prompt.id})">删除</button>
        </div>
      </div>
    </div>
  </div>
`;

// 生成提示词列表页面
export const promptListView = (prompts: Prompt[], title = '所有提示词') => {
  const promptsHtml = prompts.length 
    ? `
      <div class="row row-cols-1 row-cols-md-3 g-4">
        ${prompts.map(promptCard).join('')}
      </div>
    `
    : `
      <div class="alert alert-info text-center">
        <p class="mb-0">暂无提示词</p>
        <a href="/create" class="btn btn-primary mt-3">创建第一个提示词</a>
      </div>
    `;

  const content = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1>${title}</h1>
      <a href="/create" class="btn btn-primary">
        <i class="bi bi-plus-circle"></i> 新建提示词
      </a>
    </div>
    
    ${promptsHtml}
    
    <script>
      function deletePrompt(id) {
        if (confirm('确定要删除这个提示词吗？此操作不可恢复！')) {
          fetch(\`/api/prompts/\${id}\`, {
            method: 'DELETE',
          })
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              alert('删除成功！');
              location.reload();
            } else {
              alert('删除失败：' + (data.error || '未知错误'));
            }
          })
          .catch(error => {
            console.error('删除出错:', error);
            alert('删除出错，请查看控制台');
          });
        }
      }
    </script>
  `;

  return layout(content, title);
};

// 生成搜索结果页面
export const searchResultView = (prompts: Prompt[], query: string) => {
  return promptListView(prompts, `搜索结果：${query} (${prompts.length}个结果)`);
};
