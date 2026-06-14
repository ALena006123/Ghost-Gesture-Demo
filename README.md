# Tokyo Spirit Gesture｜东京灵能手势

一个纯浏览器运行的 **Vite + React 手势交互 Demo**，灵感来源于日式超自然动作美学。
A browser-only **Vite + React hand gesture demo** inspired by Japanese supernatural action aesthetics.

项目通过电脑摄像头、MediaPipe 手部关键点识别、Canvas 特效层和 Web Audio 合成音效，实现实时手势触发灵能视觉效果。
It uses the webcam, MediaPipe hand landmarks, a canvas effects layer, and Web Audio synthesis to trigger supernatural visual effects in real time.

## Features｜功能特点

通过电脑摄像头进行实时单手 / 双手追踪。
Realtime one-hand or two-hand tracking through the webcam.

支持多种手势触发效果。
Supports multiple gesture-triggered effects.

张开手掌：生成一个大型悬浮御札，并跟随手部移动。
Open palm: create a large floating ofuda that follows the hand.

握拳后再张开手掌：在持有御札时，将御札沿手腕到中指方向发射出去。
Fist then open palm: launch the ofuda in the wrist-to-middle-finger direction while holding it.

双手形成 O 形：蓄力生成火球。
Two hands forming an O shape: charge a fireball.

松开 O 形手势：向前发射火球。
Release the O shape: launch the fireball forward.

手指枪手势：独立发射绿色灵能子弹。
Finger-gun gesture: shoot green spirit bullets independently.

界面采用深色都市奇幻风格，搭配霓虹青色、蓝色和紫色能量特效。
The interface uses a dark urban fantasy style with neon cyan, blue, and purple energy effects.

项目包含旋转封印符文、雨滴划痕和结界网格氛围效果。
The project includes rotating seal glyphs, rain streaks, and a ward-grid atmosphere.

右下角显示小型镜像摄像头预览。
A small mirrored webcam preview is displayed in the corner.

HUD 实时显示当前手势与交互模式。
The HUD shows the current gesture and interaction mode in real time.

项目使用 Web Audio 生成简单音效，无需额外音频文件。
The project uses Web Audio to synthesize simple sound effects without external audio files.

## Tech Stack｜技术栈

Vite 用于快速搭建和运行前端开发环境。
Vite is used for fast frontend development and local preview.

React 用于构建交互界面和组件逻辑。
React is used to build the interactive interface and component logic.

MediaPipe Hand Landmarks 用于实时识别手部关键点。
MediaPipe Hand Landmarks is used for real-time hand landmark detection.

Canvas 用于绘制灵能粒子、光效和动态视觉效果。
Canvas is used to render spirit particles, light effects, and dynamic visuals.

Web Audio API 用于生成手势触发时的合成音效。
The Web Audio API is used to generate synthesized sound effects triggered by gestures.

## How to Run｜如何运行

首先打开电脑上的 Terminal 终端。
First, open the Terminal on your computer.

进入项目所在的文件夹。
Go into the project folder.
eg.
```bash
cd /Users/alena/My_Coding_Project/GestureDemo
```

第一次运行项目时，需要先安装依赖。
When running the project for the first time, install the dependencies first.

```bash
npm install
```

安装完成后，启动本地开发服务器。
After the installation is complete, start the local development server.

```bash
npm run dev
```

Terminal 会显示一个本地网址，通常是：
The Terminal will print a local URL, usually:

```bash
http://localhost:5173/
```

复制这个网址，并在 Chrome 浏览器中打开。
Copy this URL and open it in Chrome.

当浏览器询问是否允许使用摄像头时，点击允许。
When the browser asks for webcam permission, click Allow.

之后你就可以通过电脑摄像头进行手势识别，并在网页中触发灵能视觉特效。
Then you can use your computer webcam to detect hand gestures and trigger supernatural visual effects in the browser.

以后再次运行项目时，不需要重复安装依赖。
The next time you run the project, you do not need to install dependencies again.

只需要进入项目文件夹并启动开发服务器。
You only need to enter the project folder and start the development server.

```bash
cd Desktop/Tokyo-Spirit-Gesture
npm run dev
```

## Notes｜注意事项

在光线充足的环境中使用效果最好，并尽量让手完整、清晰地出现在摄像头画面内。
For best results, use the demo in a well-lit room and keep your hand clearly inside the camera frame.

当前手势分类器是 MVP 版本，主要基于 MediaPipe 手部关键点和指尖位置判断手势。
The current gesture classifier is an MVP version based on MediaPipe hand landmarks and fingertip positions.

项目目前没有使用自训练手势识别模型。
The project does not currently use a custom-trained gesture recognition model.

如果浏览器阻止摄像头访问，请使用 `localhost` 或 HTTPS 环境。
If the browser blocks camera access, use `localhost` or an HTTPS environment.

普通的不安全网页来源会受到浏览器摄像头 API 限制。
Webcam APIs are restricted on ordinary insecure origins.

## Project Positioning｜项目定位

Tokyo Spirit Gesture 是一个结合 **AI 视觉识别、前端交互、实时动画和沉浸式视觉设计** 的创意交互 Demo。
Tokyo Spirit Gesture is a creative interaction demo combining **AI vision recognition, frontend interaction, real-time animation, and immersive visual design**.

项目重点不在于制作完整游戏，而是探索如何通过浏览器摄像头和手势识别，让用户用自然手势触发具有日式灵异美学的视觉反馈。
The goal is not to build a full game, but to explore how webcam-based hand tracking can let users trigger Japanese supernatural-style visual feedback through natural gestures.


