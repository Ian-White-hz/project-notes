# 与 Claude 和 Codex 同时修改网站

本目录是网站源码。`index.html` 是当前可用的本地版网站；浏览器中的笔记数据不在 Git 仓库里。云同步仍未启用。

## 本机并行工作

- Codex 使用本目录的 `main` 分支。
- Claude 使用同级的 `claude-site` 工作目录和 `claude-updates` 分支。不要让两个助手同时直接编辑同一个目录。
- 在 Claude 工作目录打开终端，运行 `claude`，说明想改的功能；Claude 会读取 `CLAUDE.md`。
- Claude 完成后，先在其工作目录查看 `git status` 和提交，再回到本目录审核差异：`git diff main..claude-updates`。
- 审核通过后，在本目录运行 `git merge claude-updates`。若双方改了同一处，Git 会提示冲突，需要人工选择或合并内容。

PowerShell 启动 Claude：

```powershell
cd 'C:\Users\10518\Documents\Codex\2026-10-08\new-chat\claude-site'
claude
```

可以对 Claude 说：“请只在 `claude-updates` 分支修改这个网站，完成后说明改动和测试，并提交代码。”

审核和合并：

```powershell
cd 'C:\Users\10518\Documents\Codex\2026-10-08\new-chat\outputs'
git diff main..claude-updates
git merge claude-updates
```

如果 Git 提示 `dubious ownership`，在自己的终端对提示的两个目录分别运行 `git config --global --add safe.directory '目录路径'`，只信任这两个确切路径。

## 多电脑协作与上线

本地 Git 工作目录只能在这台电脑上协作。若要让不同电脑上的 Claude 与 Codex 协作，可把仓库推到一个私有 GitHub 仓库，并分别从自己的分支提交 Pull Request，再审核合并到 `main`。发布网站时，只部署经过审核的 `main` 分支。

不要把笔记备份、密码、Supabase `service_role` 密钥等提交到 Git。公开的源码仓库与云端笔记数据应分开管理。

这套 Git 流程同步的是网站代码。当前笔记内容仍保存在各浏览器的本地存储中，Claude 无法通过 Git 读取或更新它们。
