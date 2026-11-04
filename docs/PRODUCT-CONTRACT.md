# XI Node v0.1 产品契约

## 定位

本地优先、可自托管的 AI 主机。

目标用户：

```text
能运行 Docker 或 Node 的自托管用户
```

不是“下载 exe 就能用的消费级软件”。

## 支持形态

```text
Docker Compose（推荐，单仓自包含，已在本机构建运行验证）
源码运行（Node 20+）
Windows 便携 zip（可选，未签名）
浏览器 UI
本地访问令牌认证
Mock / OpenAI-compatible / Ollama
只读任务
记忆审核
审批
时间线
备份 / 恢复
```

## 不支持

```text
签名 Windows 安装器
SmartScreen 信誉
QQ
设备执行器
摄像头
自动端口扫描
多用户
公网访问
```

## 安全默认

```text
监听 127.0.0.1
除 /api/health 外所有 API 需要本机访问令牌
只执行只读技能
高风险动作只进入审批
API Key 不通过 /api/settings 回传
```

Key 当前存储在：

```text
data/model-secret.json
```

Windows 本地运行使用 DPAPI 加密；Docker/Linux 降级为本机文件存储。

## 成功标准

```text
启动后能完成向导
能创建目标并执行只读任务
能写入、审核、撤回记忆
能创建/批准审批
能查看时间线
能完成一次备份并能恢复
刷新/重启后数据仍在
控制台无未捕获异常
```