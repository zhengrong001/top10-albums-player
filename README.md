# Top 10 Albums — Capacitor Android 项目

基于原 `top10-albums.html` 改造的 Capacitor 单页应用，保留米白纸感首页、黄色高亮标题、10 个专辑盒与三层视图（首页 / 专辑详情 / 黑胶播放器），支持在 App 内导入自己的歌曲与封面并持久保存。

## 项目结构

```
top10-capacitor/
├─ www/                      Web 资源（Capacitor 的 webDir）
│  ├─ index.html             页面结构 + 样式 + 应用脚本
│  └─ assets/
│     ├─ sprite.png          原 10 个专辑盒精灵图
│     └─ vendor/             Capacitor 插件 UMD 构建（无需打包器）
├─ android/                  npx cap add android 生成的原生工程
├─ package.json              依赖与脚本
├─ capacitor.config.json     appId / appName / webDir
└─ README.md
```

## 构建命令（在有 JDK 17 + Android SDK 的机器上）

```bash
npm install
npm run cap:sync       # 同步 Web 资源与插件到 android/
npm run build:apk      # 产出 android/app/build/outputs/apk/debug/app-debug.apk
npm run cap:open       # 用 Android Studio 打开工程
```

环境要求：JDK 17、Android SDK Platform 34、Build Tools 34.0.0、Gradle 8.2.1（wrapper 自动下载）。
可设置 `JAVA_HOME` 与 `ANDROID_HOME` 指向本机安装目录。

## 云端构建 APK（GitHub Actions，无需本机 JDK/SDK）

仓库已包含 `.github/workflows/build-android.yml`。推送到 `main`/`master` 会自动构建；也可在 GitHub 仓库 **Actions → Build Android APK → Run workflow** 手动触发。

云端会依次安装 Node 20、JDK 17、Android SDK 34，执行 `npm ci`、`npx cap sync android`、`./gradlew assembleDebug`，最后把 APK 上传为 Artifact。

下载：进入对应 Run 页面，在 **Artifacts** 区下载 `top10-albums-debug-apk`（debug 版，可直接安装；有效期 30 天）。

> 注意：GitHub Actions 只在 GitHub 上可用。Gitee 需要用「Gitee Go」等自有流水线，不能直接运行本工作流。

## 在 App 内导入自己的歌和封面

1. 首页右下角黑色圆按钮 **＋** → 填写专辑名、歌手 → 选择专辑封面图（可选）→ 选择 1 个或多个 mp3/m4a 音频 → 点「导入」。
2. 进入任意专辑 → 右上「＋ 歌曲」可继续往该专辑追加音频，封面可选（不选则沿用专辑封面）。
3. 导入后首页会在原 10 个盒子之后追加你的专辑，点击即可进入详情与播放器。

**文件存在哪里**：音频与封面被复制到 App 的 `Documents` 目录（`@capacitor/filesystem` 的 `Directory.Documents`，Android 上为应用私有外部 Documents 目录），文件名带时间戳和随机串避免冲突；专辑/歌曲元数据（歌名、歌手、文件名、时长）保存在 Capacitor `Preferences` 中。Web 预览模式下则退回 localStorage 与 dataURL。

**如何删除**：
- 删除单首歌：专辑详情里该歌曲行右侧的 **×**，确认后删除元数据并删除对应音频文件（若封面仅被这首歌使用，也会一并删除）。
- 删除整张专辑：专辑详情右上「删除」，确认后删除专辑下所有音频与封面文件，并移除元数据。

## 音频播放

使用 `@capacitor-community/native-audio` 播放 `Documents` 中的本地文件（通过 `Filesystem.getUri` 得到 `file://` URI），支持播放/暂停、上一首/下一首、进度 seek（`play({time})`）、播放结束自动下一首；不自动播放。Web 预览模式使用 `<audio>` 降级，行为一致。

`android/app/src/main/AndroidManifest.xml` 已声明 `FOREGROUND_SERVICE`、`WAKE_LOCK`、`POST_NOTIFICATIONS`、`READ_MEDIA_AUDIO` 等权限。注意：该社区插件不提供锁屏/通知栏控制 UI；若需要完整的后台通知控制，请替换为 `@capawesome-team/capacitor-audio-player` 并配置 `showNotification`。

## 保留的原有视觉与交互

- 首页 `#F2F3EB` 米白底、黑色 900 粗体标题、`Top 10` 黄色 `#FAD709` 圆角高亮、底部 `Make yours at taylor.fyi/top`、10 个盒子滑入动效。
- 三层视图与 FLIP 共享元素放大过渡（420ms `cubic-bezier(.22,1,.36,1)`）、`prefers-reduced-motion` 下关闭飞行与黑胶旋转但保留淡入淡出与播放控制。
- 黑胶 CSS 纹路与播放旋转、切歌封面交叉淡入、进度条点击/拖动、空格/左右/Esc 快捷键。
