# Docker Verification

本机已安装：

```text
Docker Desktop 4.98.0
WSL 2.7.14
VirtualMachinePlatform / WSL features enabled
```

但启用 WSL2 需要一次 Windows 重启。

2026-11-04 已完成重启后验证：

```text
docker compose build   PASS
docker compose up -d   PASS
/api/status            PASS
/api/model/test        PASS
/api/chat              PASS
PASS Docker build + run
```

重启后：

```powershell
cd xi-node
powershell -ExecutionPolicy Bypass -File scripts/verify-docker.ps1
```

脚本会：

```text
检查 Docker CLI
检查 daemon
docker compose config
docker compose build
docker compose up -d
读取 /data/access-token
轮询 /api/status（Bearer token）
docker compose ps
写入 dist/docker-verify.log
```

如果 Docker Desktop 首次启动需要接受许可，请先打开 Docker Desktop 完成一次启动，再运行脚本。

不自动删除容器或数据卷。