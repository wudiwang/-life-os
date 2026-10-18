# 泰语课程音频

课程声音是预生成的泰语合成语音，文件随网页发布到 `public/audio/thai/`。播放不需要浏览器或手机安装泰语朗读音色，也不在用户点击时调用收费接口。短对话逐句合成，不使用单词录音拼接。

生成来源为 Microsoft Edge 在线朗读服务，经开源 [edge-tts](https://github.com/rany2/edge-tts) 工具调用。当前使用 `edge-tts 7.3.1`、`th-TH-PremwadeeNeural` 泰语女声音色、正常语速 `+0%`。生成过程只发送静态课程的泰文词句，不读取个人记忆、学习记录、`.env` 或云端密钥；没有开通付费 API、创建账号或购买服务。

这不是微软正式的付费语音 API 集成，服务未来可能变化。现有 MP3 文件在生成后独立播放。音频明确标为合成，技术校验不能代替母语者对发音、声调和自然度的审听。

## 重新生成

需要 Python 3、Node 和 PATH 中的 `ffprobe`（FFmpeg）。依赖只用于生成，不进入网页运行时：

```powershell
python -m pip install --user edge-tts==7.3.1
python scripts/generate-thai-audio.py --limit 3
python scripts/generate-thai-audio.py
python scripts/generate-thai-audio.py --verify-only
```

生成器通过 Node 将受信任的 `src/pages/Thai/thaiLessons.js` 导出为 JSON，只提取30课的 `words` 和 `dialogue` 泰文。预计210个播放条目。完全相同的泰文只请求生成一次，再映射为各自稳定的 `{id}.mp3` 文件，方便课程直接引用。

默认最多3个并发请求，每条最多3次尝试，每次不超过50秒；可用 `--concurrency 1` 降低并发。失败日志只显示条目ID和错误类型，避免输出服务请求信息。每完成一组即保存清单；重新运行会核对文本、音色、语速和文件哈希，复用有效文件，修复缺失或变化的条目。生成中的临时文件放在 `public` 外，校验通过后再原子替换成正式文件，避免构建读到半成品。所有源文件与音频映射均记录在 `manifest.json`，包括音色、工具版本、合成时间、时长、字节数、SHA-256和复用来源。

## 校验范围

`--verify-only` 不联网：检查210个ID与课程对应、文件存在且与清单哈希一致，拒绝HTML/JSON错误页，逐一用 `ffprobe` 核实MP3流、合理时长与体积，并检查多余MP3。运行时网页仍需处理资源404、网络中断和浏览器禁止自动播放等情况。

本次生成前的小样“สวัสดีครับ”已成功返回MP3：24 kHz、单声道、1.968秒、11,808字节。母语者审听尚未完成，不宣称真人录音或已经获得母语级审校。

2026-10-18 交付校验：210个播放文件覆盖172条不同泰文，总体积2,615,904字节，单条时长1.872至2.976秒；全部通过 `ffprobe` 格式、时长及哈希核对，并由 FFmpeg 完整解码，0个解码失败。课程最终版本的源文件哈希已刷新；`public/audio/thai/` 中没有临时文件。
