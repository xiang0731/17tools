# 17Tools

17Tools是一个基于HTML的工具集合网页应用，提供了多种实用的文本处理工具。

## 功能特点

### 1. 主界面
- 采用侧边栏布局设计
- 支持侧边栏折叠/展开
- iframe内容加载方式
- 默认显示欢迎页面
- 响应式设计，自适应移动端和桌面端
- 支持手动切换移动版/桌面版视图
- 访问统计功能

### 2. 文本转换工具 (Transformer)
提供14种文本转换功能：
- A-添加单引号和逗号
- B-合并为一行
- C-句首字母大写
- D-单词首字母大写
- E-添加__c后缀
- F-去除空格
- G-转换小写
- H-转换大写
- I-提取首个字符
- J-添加前缀
- K-添加后缀
- L-提取特定前值
- M-提取特定后值
- N-添加顺序前缀

### 3. 文本替换工具 (Replacer)
- 支持原文本、替换文本和被替换文本的输入
- 提供复制/粘贴功能
- 保存替换历史记录
- 一键清空所有内容
- 支持快速恢复历史记录

### 4. 极速计算器 (Calculator)
- 支持多行数字计算
- 保存计算历史记录
- 支持复制计算结果
- 实时计算和显示结果

### 5. 代码格式化工具 (PrettyFormat)
- 支持多种编程语言代码格式化
- 基于Prettier实现规范化格式
- 自动语法高亮显示
- 显示行号
- 支持多种语言格式化和高亮

### 6. 世界时间工具 (WorldTime)
- 显示多个时区的时间
- 直观的模拟时钟显示
- 支持时区选择
- 显示时差信息
- 美观的苹果风格界面

### 7. 关于页面 (About)
- 项目信息展示
- 动画效果展示
- 包含项目相关说明

## 技术实现
- 纯HTML/CSS/JavaScript实现
- 响应式布局设计
- 本地存储实现历史记录功能
- 模块化的工具组件设计
- 使用外部库如Prettier和highlight.js实现代码格式化
- 使用TailwindCSS实现部分工具的样式

## 使用方法
1. 直接打开index.html文件
2. 通过侧边栏选择所需工具
3. 根据工具提示进行相应操作
4. 移动设备可切换桌面/移动视图

## 项目结构

17Tools/
├── index.html # 主页面
├── items/ # 工具集
│ ├── Welcome.html # 欢迎页
│ ├── Calculator.html # 极速计算器
│ ├── PrettyFormat.html # 代码格式化工具
│ ├── Replacer.html # 文本替换工具
│ ├── Transformer.html # 文本转换工具
│ ├── WorldTime.html # 世界时间工具
│ ├── About.html # 关于页面
└── README.md # 说明文档