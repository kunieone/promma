export const layout = (content: string, title = '提示词管理系统') => `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
</head>
<body>
  <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
    <div class="container">
      <a class="navbar-brand" href="/">提示词管理系统</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav me-auto">
          <li class="nav-item">
            <a class="nav-link" href="/">所有提示词</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="/create">创建提示词</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="/generate">AI生成</a>
          </li>
        </ul>
        <form class="d-flex" action="/search" method="GET">
          <input class="form-control me-2" type="search" name="q" placeholder="搜索提示词...">
          <button class="btn btn-light" type="submit">搜索</button>
        </form>
      </div>
    </div>
  </nav>

  <main class="container my-4">
    ${content}
  </main>

  <footer class="bg-light py-3 mt-5">
    <div class="container text-center">
      <p class="mb-0">© ${new Date().getFullYear()} 提示词管理系统 - 使用 Bun.js 构建</p>
    </div>
  </footer>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js"></script>
  <script src="/js/main.js"></script>
</body>
</html>
`;
