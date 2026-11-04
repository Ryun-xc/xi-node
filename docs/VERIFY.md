# 如何验证 XI Node

## 一键自动检查

```powershell
cd xi-node
powershell -ExecutionPolicy Bypass -File scripts/verify.ps1
```

它会检查：

```text
Node 版本
xi-core 17 个测试
xi-node API / model / persistence / auth / backup 测试
本地服务启动
Mock 模型测试连接
便携 zip 是否存在
Docker 是否存在（没有会 WARN）
UI smoke 是否可运行（没有 CDP 会 WARN）
```

成功输出：

```text
ALL AUTOMATED CHECKS PASSED
```

有 Docker/UI smoke 被跳过时，会显示 `WARN`，不是失败。

---

## 手动验收

### 1. 启动

```powershell
cd xi-node
node server.mjs
```

读取：

```text
data/access-token
```

打开：

```text
http://127.0.0.1:8787/?token=<token>
```

### 2. 首启向导

应该看到：

```text
欢迎
记忆
模型
```

完成后进入总览。

### 3. 对话

在对话页发送：

```text
帮我整理一个本地 AI 计划
```

应该看到回复，并且对话被写入记忆。

### 4. 目标

目标页：

```text
创建目标
添加只读任务
运行只读任务
```

运行后应该看到任务变为 `done`，时间线出现事件。

### 5. 记忆

记忆页：

```text
写入一条
模拟模型推断
批准 / 拒绝
```

推断条目应进入待审核，批准后进入已启用。

### 6. 审批

审批页：

```text
创建一个演示审批
批准 / 拒绝
```

刷新后应该还在。

### 7. 设置

设置页：

```text
Provider / 模型 / 地址 / API Key
测试连接
保存设置
```

Mock 测试应该成功。

### 8. 重启

停止服务，重新启动。

应该仍然看到：

```text
目标
任务
记忆
审批
时间线
```

### 9. 备份与恢复

设置页点击“立即备份”。

数据目录下出现：

```text
backups/<timestamp>/
```

再用 `npm run restore -- --data data --id <id>` 恢复，重启后应回到备份状态。

### 10. Windows 便携包

```text
解压 dist/xi-node-win-x64-v0.1.0.zip
双击 START.vbs
```

应该：

```text
无 cmd 窗口
托盘出现
浏览器打开
服务健康
```

---

## 当前无法在本机验证

```text
干净 Windows VM：本机没有 VM
真实外部模型：没有用户 API Key
可信代码签名：没有证书，且已决定不提供 exe 安装器
```

## 已额外验证

```text
Docker Desktop 安装
docker compose build
docker compose up -d
/api/status
/api/model/test
/api/chat
PASS Docker build + run
```