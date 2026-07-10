强制性规则
唯一构建目标

验证仅以 src-tauri/target/release/visionox-whale.exe 及其对应的 resources/ 目录为准。

未经用户明确批准，不得使用 target/debug、安装副本或其他目录替代。

禁止重复构建与垃圾目录

严禁在仓库内创建任何额外构建目录（如 target/debug、target/*-build、*.old、*.bak 等），也不得复制 server/ 或产生审计、临时副本。除非获得用户单独授权。

不得手动拷贝资源到 target/release，构建必须直接生成规范的 resources/。

非测试 Rust 代码不得通过 `CARGO_MANIFEST_DIR`、绝对项目路径、安装目录或其他副本读取/修复运行时资源。程序运行时只允许从 `current_exe()` 同级的 `resources/` 读取资源；资源缺失必须明确失败，由构建流程修复。

若 release 文件被锁定，关闭相关进程（Visionox、Node、OfficeCLI）后继续使用同一目标，不得重定向输出。

删除任何生成物前，必须先确认其绝对路径位于仓库内，且不是上述规范可执行文件或资源树。

命令执行限制

禁止运行任何会创建 target/debug 的命令（如 cargo build、cargo test、tauri dev）。

若确需 Rust 测试，必须征得用户同意，但依然禁止重复构建与生成副本
发布构建必须使用 npm run tauri:build -- --no-bundle，除非用户明确要求安装程序。

除非申请用户授权，否则不得在构建或验证过程中下载任何依赖或工具，尽量仅使用既有离线缓存。

未经明确要求，不得主动启动或安装 NSIS 包。

临时文件与验证

所有临时数据（解压、审计、比较、测试）必须放在系统临时目录，绝不允许置于仓库内。

命令完成后（无论成功或失败）须立即清理这些临时数据。

在运行任何会创建新持久目录或资源副本的命令前，必须事先汇报。


在执行明确要求的重新构建时，可以关闭 Visionox 所属进程。
