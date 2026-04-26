# 发布到 GitHub

这份教程按最简单的方式写，你照着做就能发出去。

## 你需要准备

1. 一个 GitHub 账号
2. 电脑里安装 Git
3. 这个项目文件夹已经在本地

## 第一步：安装 Git

如果你的电脑里还没有 Git：

1. 打开 [Git for Windows](https://git-scm.com/download/win)
2. 下载并安装
3. 安装完成后，重新打开终端或 PowerShell

## 第二步：在 GitHub 新建仓库

1. 打开 [GitHub](https://github.com/)
2. 点击右上角 `+`
3. 选择 `New repository`
4. 仓库名填写：`windows-spotlight-exporter`
5. 选择 `Public`
6. 点击 `Create repository`

创建完成后，GitHub 会给你一个仓库地址，类似：

```text
https://github.com/你的用户名/windows-spotlight-exporter.git
```

## 第三步：把本地项目传上去

在这个项目目录打开 PowerShell，然后依次运行：

```powershell
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/windows-spotlight-exporter.git
git push -u origin main
```

## 第四步：别人怎么用

别人打开你的仓库后：

1. 点击 `Code`
2. 点击 `Download ZIP`
3. 解压
4. 安装 Node.js
5. 双击 `start.bat`

## 你发布时可以直接这样写介绍

```text
一个本地 Windows 小工具，用来自动查找 Windows 聚焦缓存图片，并导出为正常可查看的 JPG 文件。
```

## 补充说明

- 这个工具只支持 Windows
- 需要本机开启 Windows 聚焦
- 需要安装 Node.js
- 默认导出目录是“图片/WindowsSpotlightExport”
