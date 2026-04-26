# Windows Spotlight Exporter

一个本地小工具，用来自动查找 Windows 聚焦缓存图片，并导出为可正常查看的 `.jpg` 文件。

## 功能

- 自动扫描 Windows 聚焦缓存目录
- 预览最多 24 张缓存图片
- 默认只导出横版 JPEG 壁纸
- 支持最小宽高筛选
- 已存在文件时可跳过覆盖
- 一键打开导出目录

## 运行条件

- Windows 10 或 Windows 11
- 已安装 Node.js
- 系统已启用 Windows 聚焦，并且本机已有缓存图片

## 使用方法

1. 下载或解压这个项目
2. 双击 `start.bat`
3. 浏览器会自动打开 `http://127.0.0.1:3210`
4. 点击“开始导出”
5. 默认导出到 `C:\Users\你的用户名\Pictures\WindowsSpotlightExport`

## 常见问题

### 页面提示“未找到 Windows 聚焦缓存目录”

通常是以下原因之一：

- 当前系统还没有积累聚焦缓存
- 锁屏或桌面没有启用 Windows 聚焦
- 当前 Windows 账号权限限制了该目录读取

### 别人想用怎么办

最简单的方式就是把整个项目发到 GitHub，别人下载后：

1. 安装 Node.js
2. 解压项目
3. 双击 `start.bat`

## 发布到 GitHub

仓库发布说明见 [PUBLISH_TO_GITHUB.md](C:/Users/Ryan_/Documents/Codex/2026-04-26/web/PUBLISH_TO_GITHUB.md)。
