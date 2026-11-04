# XI Node 开源白皮书

```text
版本：v0.1
日期：2026-11-04
作者：Runcheng Zhou
仓库：https://github.com/Ryun-xc/xi-node
Release：https://github.com/Ryun-xc/xi-node/releases/tag/v0.1.0
许可证：Apache-2.0
状态：公开技术预览版
```

---

## 摘要

XI Node 是一个本地优先、可自托管的 AI 主机。

它不训练模型，也不试图成为另一个聊天 SaaS。它解决的是 AI 在长期使用中的四个问题：

```text
记忆没有来源
目标只停留在对话里
动作没有审批边界
结果没有证据
```

XI Node 把这些问题收敛到一个本地运行的主机中：

```text
浏览器 UI
持久对话
记忆账本
目标与只读任务
审批
证据与时间线
备份恢复
模型适配
```

它的目标不是让 AI 更会说话，而是让 AI 的行为更可追溯、更可控制。

---

## 一、为什么做这个项目

这个项目来自我较早的 QQ AI 同伴 / 朋友型项目“小汐”。

小汐的形态是：

```text
QQ 私聊 / 群聊
AI 人格
消息、图片、语音
长期关系
```

在长期运行中，反复出现：

```text
聊完就忘
记忆没有来源
目标和任务只存在于对话
模型给出的下一步没有被验证
高风险动作没有明确批准边界
数据散落在聊天、日志、脚本和数据库
```

这些问题不是换一个更大的模型就能解决的。

它们需要一层“主机”：

```text
管理上下文
保存记忆
记录来源
拆解目标
等待确认
留下证据
```

XI Node 就是这层主机。

---

## 二、项目定位

### 是什么

```text
本地 AI 主机
本地记忆账本
目标与任务运行时
审批与证据层
模型无关的接入层
可被其他 AI 接入的本地后端
```

### 不是什么

```text
不是模型
不是云端 SaaS
不是 QQ / 微信机器人
不是设备控制器
不是多租户平台
不是签名 Windows 安装器
```

一句话：

```text
模型负责理解和生成；
XI Node 负责记忆、目标、审批、证据和时间线。
```

---

## 三、设计原则

### 1. 本地优先

默认只监听：

```text
127.0.0.1
```

数据、API Key、聊天、记忆和审批默认留在本机。

### 2. 人必须在环里

模型可以提出目标、任务和下一步，但不能：

```text
自动创建目标
自动执行高风险动作
自己给自己授权
```

### 3. 记忆必须有来源

每条记忆至少包含：

```text
source
epistemic
confidence
review status
createdAt
```

观察和推断分开；推断需要审核。

### 4. 模型可替换

支持：

```text
Mock
OpenAI-compatible（DeepSeek 等）
Ollama
```

### 5. 小依赖面

运行时使用 Node.js 内置模块。

没有 Electron，没有前端框架，没有 SQLite 依赖。

---

## 四、系统架构

```text
浏览器 / PWA / MCP 客户端 / 外部 AI
                 │
                 ▼
        XI Node HTTP Server
        ├─ 认证
        ├─ 聊天 / 流式
        ├─ 模型 Provider
        ├─ 目标 / 任务
        ├─ 记忆审核
        ├─ 审批
        ├─ 知识库
        ├─ 备份 / 恢复
        └─ MCP
                 │
                 ▼
             XI Core
        ├─ 事件存储
        ├─ 目标存储
        ├─ 任务执行
        ├─ 记忆记录
        ├─ 策略 / 审批
        ├─ 验证器
        └─ 时间线
                 │
                 ▼
     OpenAI-compatible / Ollama / Mock
```

`core/` 是内嵌的 XI Core，部署时不依赖同级目录。

可选多用户：

```text
Multi-user Gateway
   ├─ User A → 独立 data dir
   ├─ User B → 独立 data dir
   └─ User C → 独立 data dir
```

---

## 五、当前能力

### 已具备

```text
浏览器 UI
首启向导
中 / 繁 / 英 / 西 多语言
Docker 单容器部署
访问令牌认证
OpenAI-compatible / Ollama / Mock
流式聊天
聊天历史持久化
记忆来源与审核
相关记忆召回
聊天 → 结构化提案 → 用户确认 → 目标 / 任务
只读任务执行
时间线证据
审批执行（只读技能 / 工作区写入）
本地知识库词项召回
MCP 只读工具
可选本地多用户
备份与恢复
PWA 静态壳
OpenAPI 文档
CI：test + Docker
```

### 第一版边界

```text
只监听本机
没有 TLS 终结
没有公开注册
没有高风险外部执行器
知识库不是向量检索
多用户是本地模式，不是 SaaS
无障碍只做了基础
没有 24 小时 soak
```

---

## 六、现在到哪一步了

### 已发布

```text
Repository: public
Version: v0.1.0
License: Apache-2.0
CI: test success + docker success
Release: v0.1.0
```

### 已验证

```text
core tests 17/17
API / 模型 / 认证 / 审批 / 备份 / 流式 / 历史 / 召回 / 知识库 / MCP
UI smoke
Docker build + health
本地多用户隔离
DeepSeek 真实对话
```

### 尚未验证

```text
干净 Windows VM 安装 / 运行
24 小时 soak
完整无障碍审计
高风险外部动作安全边界
```

### 当前判断

```text
可公开源码：是
可本地自托管：是
可生产级部署：否
可消费级一键安装：否
```

---

## 七、开源治理

### 许可证

```text
Apache-2.0
Copyright 2026 Runcheng Zhou
```

保留：

```text
LICENSE
NOTICE
```

### 发布策略

```text
main = 开发分支
tag = 固定版本
Release = 可引用版本
```

当前版本：

```text
v0.1.0
```

### 贡献边界

欢迎：

```text
bug report
文档修正
测试补充
Provider 适配
可访问性改进
安全审计
```

需要先讨论：

```text
新的执行器
多租户
远程网络暴露
自动执行
```

原因：

```text
这些改动会改变安全边界。
```

### 安全披露

不要在公开 issue 中粘贴：

```text
API Key
access-token
聊天记录
记忆内容
私有配置
```

---

## 八、路线图

### v0.1 —— 公开技术预览

状态：已完成

```text
单仓自包含
Docker
认证
真实模型
流式
历史
记忆
目标 / 任务
审批
备份
多语言
CI
Release
```

### v0.2 —— 发布加固

```text
干净 Windows VM 验收
24 小时 soak
完整无障碍检查
高风险执行器安全设计
向量检索实验
```

### v0.3 —— 同伴接入

```text
Xiaoxi / QQ 通道接入
人格层与主机层解耦
语音与多模态入口
多用户管理
```

### v1.0 —— 稳定版

条件：

```text
可重复安装
有真实用户
有安全审计
有升级与回滚
有长期运行数据
```

---

## 九、回到小汐

XI Node 不是小汐的替代品。

更合适的分工是：

```text
XI Node = 公开的本地认知主机
小汐    = 私有的 QQ AI 同伴 / 朋友型产品
```

小汐继续保留：

```text
QQ 通道
人格
语气
关系
语音
互动方式
```

XI Node 提供：

```text
记忆账本
目标 / 任务
审批
证据
时间线
模型适配
```

接入方式：

```text
小汐 → HTTP API → XI Node
```

需要：

```text
access-token
XI_NODE_URL
独立数据目录
不把私人聊天写进公开仓库
```

下一步不是把 XI Node 做成小汐，而是：

```text
把 XI Node 作为小汐的认知后端，
把小汐作为 XI Node 的第一个真实同伴客户端。
```

---

## 十、给开发者的最小理解

```text
它像什么：
  一个本地 AI 工作台 + 记忆账本 + 审批层

它不像什么：
  一个只会返回文本的聊天框

它适合谁：
  做 AI 同伴 / 助手 / 角色型 AI 的开发者
  需要本地记忆和审批的人

它不适合谁：
  想开箱即用的普通消费者
  需要 SaaS 多租户的团队
```

---

## 十一、结论

```text
XI Node 是一个已经公开、可运行、CI 通过的
本地 AI 主机 v0.1。

它还没有完成生产级验收，
但它已经把“记忆、目标、审批、证据”
从聊天应用里拆成了一个可被其他 AI 使用的主机。
```

项目地址：

```text
https://github.com/Ryun-xc/xi-node
```