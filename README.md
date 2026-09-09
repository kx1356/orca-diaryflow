# 日记流（orca-diaryflow）

虎鲸笔记（Orca Note）插件：朋友圈式日记时间流。

## 功能

- 时间线展示带 `#日记流` 标签的日记块
- 封面 / 头像 / 签名设置
- 标签筛选、置顶、评论、地点（写入正文末行 `地点：XXX`）
- 新建与深度编辑跳转虎鲸日记页

## 安装

1. 从 [Releases](https://github.com/kx1356/orca-diaryflow/releases) 下载 zip
2. 解压到虎鲸 `plugins` 目录（如 `Documents/orca/plugins/`）
3. 重启虎鲸并在设置中启用「日记流」

## 开发

```bash
node build.mjs
node tools/deploy.mjs
```

## License

MIT
