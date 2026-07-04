【情感陪护数字人系统项目介绍】本项目打造面向用户的情感陪护数字人交互平台，融合AI对话、实时情绪识别与数字人驱动技术，为用户提供沉浸式情感陪伴体验。系统依据C端用户倾诉陪伴、情绪感知与互动需求，对业务功能进行合理划分。用户端支持用户注册登录、AI智能对话聊天、实时面部情绪识别分析、数字人形象驱动（Live2D/LiveTalking/百度数字人）、语音输入与TTS语音合成、历史会话记录管理等功能，满足用户日常情感倾诉、情绪感知与陪伴互动需求。后端支持SiliconFlow大模型对话、情感分析引擎、TTS语音服务及会话数据管理，保障系统智能交互体验与数据安全。

【开发技术栈】Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, Zustand, Express.js, PostgreSQL, Prisma ORM, JWT, SiliconFlow (Qwen2.5-7B), Docker, Python, Flask, OpenCV, LiveTalkin(实时流式数字人), WebRTC.

【部分核心功能实现】
· AI情感对话引擎：基于SiliconFlow的Qwen2.5-7B大模型构建对话引擎，结合情绪分析系统对用户消息进行实时情感识别，使AI回复更具共情力与个性化，提升陪伴体验的真实感。
· 实时面部情绪识别：集成Python + OpenCV + 深度学习模型，通过摄像头实时捕捉用户面部表情，识别高兴、悲伤、愤怒、惊讶等多类情绪概率，为AI对话提供情感上下文输入。
· 数字人多模驱动：支持Live2D轻量级数字人、LiveTalkin实时流式数字人（wav2lip/musetalk/ernerf）及百度数字人等多种驱动方案，结合TTS语音合成实现音视频同步对话，打造可视化的沉浸式交互体验。
· 语音交互链路：集成百度ASR语音识别与多引擎TTS语音合成，支持用户语音输入提问与数字人语音回复，实现完整的语音对话闭环，降低交互门槛。
