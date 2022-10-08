# Valine

[![version](https://img.shields.io/github/release/xCss/Valine.svg?style=flat-square)](https://github.com/xCss/Valine/releases) [![npm downloads](https://img.shields.io/npm/dm/valine.svg?style=flat-square)](https://www.npmjs.com/package/valine) [![build](https://img.shields.io/circleci/project/github/xCss/Valine/master.svg?style=flat-square)](https://circleci.com/gh/xCss/Valine) [![donate](https://img.shields.io/badge/$-donate-ff69b4.svg?maxAge=2592000&style=flat-square)](#donate)  

> A fast, simple & powerful comment system. 
> 适配memfire 
------------------------------
**[View Documentation](https://valine.js.org)**

## Features
- High speed.
- Safe by default.
- No server-side implementation.
- Support for full markdown syntax.
- Simple and lightweight.

See the [Quick start](https://valine.js.org) for more details.

## Contributors
- [Contributors](https://github.com/xCss/Valine/graphs/contributors)

## 集成
1. https://cloud.memfiredb.com/auth/login 注册登录
2. 创建应用，进入应用数据库创建`comments`表用于存储评论。
```
CREATE TABLE comments
(
   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment text,
    QQAvatar varchar(300),
    time	int,
    title	varchar(300),
    updatedAt	timestamptz,
    createdAt	timestamptz,
    pid	varchar(300),
    url	varchar(300),
    link varchar(300),
    rid varchar(300),
    mail varchar(300),
    ua varchar(300),
    nick varchar(300),
    ip varchar(300)
);
```
3. 进入应用，获取`网址`与`anon key`
4. index.html 填入`app_url`与`app_key`
```
valine.init({
    el: '.comment',
    app_key: '填入appkey',
    app_url: '填入app_url',
    placeholder: 'ヾﾉ≧∀≦)o来啊，快活啊!',
    path: window.location.pathname,
    avatar:'mm', // 1.1.7 新增(mm/identicon/monsterid/wavatar/retro)
    // guest_info: ['nick'] // 默认 ['nick', 'mail', 'link']
})
```

```
npm install
npm run build
```


主要用到的js文件就是打包文件：dist/Valine.min.js
## 静态托管
打包全部文件上传到Memfire Cloud的静态托管

## 在线体验
https://app.memfiredb.com/cb589ci5g6h46gn9g6q0/

## License
[GPL-2.0](https://github.com/xCss/Valine/blob/master/LICENSE)
