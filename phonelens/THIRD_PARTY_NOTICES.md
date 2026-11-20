# 第三方说明

## itsyujay/apple-style-portfolio

- 仓库：https://github.com/itsyujay/apple-style-portfolio
- 参考提交：`3c793a36d87ef5f2800d786b02593e957c9ed669`
- 已读取的文件：`LICENSE`、`README.md`、`src/components/Hero.astro`、`src/layouts/Layout.astro`
- 许可：MIT（全文见下）

**借鉴内容（已改写为本项目的 CSS 与 React 组件，没有复制 Astro 源文件）：**

- `Hero.astro`：居中标题与副标题、标题与副标题的字号层级（约 6xl / 3xl）、胶囊形按钮（`rounded-full`、横向较宽的内边距）、标题区先淡入、操作区稍后上移进入的节奏。对应 `src/app/globals.css` 的 `.hero`、`.btn`、`.enter` 与 `src/app/page.tsx`。
- `Layout.astro`：浅灰页面与深灰文字的配色关系、系统字体优先的字体栈思路、蓝色强调色变量。本项目改用指定色值 #FFFFFF / #F5F5F7 / #1D1D1F / #6E6E73 / #0071E3，字体改为苹方优先的系统字体，不加载外部字体。

**未使用：** `Scene3D` 三维场景、头像图片（来自 Unsplash 链接，素材许可未确认）、`DemoBanner`、`ProjectCard` 卡片网格、个人履历、技能、评价与社交模块、`min-h-screen` 整屏 Hero、Inter / Source Sans Pro 字体包、GSAP 与 Three.js。`README.md` 中提到的 `COMMERCIAL.md` 未读取，与本项目无关。

```
MIT License

Copyright (c) 2025 yujian(larry) xue

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 其他视觉参考（未使用代码）

- Apple 中国大陆 iPhone 机型比较页（https://www.apple.com.cn/iphone/compare/）：仅作为“产品图、型号、少量主要差异”并列布局的视觉参考。开发环境无法访问该页面，未读取其内容，也未使用其任何代码、图片或文字。
- houssemeddine-bouachiri/React-iPhone：本轮未读取、未使用。
