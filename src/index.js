const VERSION = require('../package.json').version;
const md5 = require('blueimp-md5');
const {marked} = require('marked');
const autosize = require('autosize');
const timeAgo = require('./utils/timeago');
const detect = require('./utils/detect');
const Utils = require('./utils/domUtils');
const Emoji = require('./plugins/emojis');
const hanabi = require('hanabi');
// const AV = require('leancloud-storage')
const client = require('@supabase/supabase-js')
// import { createClient } from '@supabase/supabase-js'
var supabase;

const defaultComment = {
    comment: '',
    nick: 'Anonymous',
    mail: '',
    link: '',
    ua: navigator.userAgent,
    url: ''
};

class Comment {
    constructor() {
        this.comment = defaultComment.comment;
        this.nick = defaultComment.nick;
        this.mail = defaultComment.mail;
        this.link = defaultComment.link;
        this.ua = defaultComment.ua;
        this.url = defaultComment.url;
        this.id = '';
        this.pid = '';
        this.rid = '';
    }
}

function guid() {

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {

        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);

        return v.toString(16);

    });

}

const locales = {
    'zh-cn': {
        head: {
            nick: '昵称',
            mail: '邮箱',
            link: '网址(http://)',
        },
        tips: {
            comments: '评论',
            sofa: '快来做第一个评论的人吧~',
            busy: '还在提交中，请稍候...',
            again: '这么简单也能错，也是没谁了.'
        },
        ctrl: {
            reply: '回复',
            ok: '好的',
            sure: '确认',
            cancel: '取消',
            confirm: '确认',
            continue: '继续',
            more: '查看更多...',
            try: '再试试?',
            preview: '预览',
            emoji: '表情'
        },
        error: {
            99: '初始化失败，请检查init中的`el`元素.',
            100: '初始化失败，请检查你的AppId和AppKey.',
            401: '未经授权的操作，请检查你的AppId和AppKey.',
            403: '访问被api域名白名单拒绝，请检查你的安全域名设置.',
        },
        timeago: {
            seconds: '秒前',
            minutes: '分钟前',
            hours: '小时前',
            days: '天前',
            now: '刚刚'
        }
    },
    en: {
        head: {
            nick: 'NickName',
            mail: 'E-Mail',
            link: 'Website(http://)',
        },
        tips: {
            comments: 'comments',
            sofa: 'No comments yet.',
            busy: 'Submit is busy, please wait...',
            again: 'Sorry, this is a wrong calculation.'
        },
        ctrl: {
            reply: 'Reply',
            ok: 'Ok',
            sure: 'Sure',
            cancel: 'Cancel',
            confirm: 'Confirm',
            continue: 'Continue',
            more: 'Load More...',
            try: 'Once More?',
            preview: 'Preview',
            emoji: 'Emoji'
        },
        error: {
            99: 'Initialization failed, Please check the `el` element in the init method.',
            100: 'Initialization failed, Please check your appId and appKey.',
            401: 'Unauthorized operation, Please check your appId and appKey.',
            403: 'Access denied by api domain white list, Please check your security domain.',
        },
        timeago: {
            seconds: 'seconds ago',
            minutes: 'minutes ago',
            hours: 'hours ago',
            days: 'days ago',
            now: 'just now'
        }
    }
}

let _avatarSetting = {
        cdn: 'https://gravatar.loli.net/avatar/',
        ds: ['mp', 'identicon', 'monsterid', 'wavatar', 'robohash', 'retro', ''],
        params: '',
        hide: false
    },
    META = ['nick', 'mail', 'link'],
    _store = Storage && localStorage && localStorage instanceof Storage && localStorage;

function ValineFactory(option) {
    let root = this;
    root.init(option);
    // Valine init
    return root;
}

const insertComment = async(comment) => {
    let {data, error} = await supabase
    .from('comments')
    .insert([
      { 
        id: comment['id'],
        url: comment['url'],
        pid: comment['pid'],
        rid: comment['rid'],
        createdat:comment['createdat'],
        comment: comment['comment'],
        nick: comment['nick'],
        mail: comment['mail'],
        link: comment['link'],
        ua: comment['ua'],
        }
    ])
    if (error) {
        console.log(error.message)
        return null
    }
    return data[0]
}

/**
 * Valine Init
 */
ValineFactory.prototype.init = function (option) {
    let root = this;
    root['config'] = option
    if (typeof document === 'undefined') {
        console && console.warn('Sorry, Valine does not support Server-side rendering.')
        return;
    }
    !!option && root._init();
    return root;
}

ValineFactory.prototype._init = function(){
    let root = this;
    try {
        let {
            lang,
            langMode,
            avatar,
            avatarForce,
            avatar_cdn,
            notify,
            verify,
            visitor,
            path = location.pathname,
            pageSize,
            recordIP,
            clazzName = 'Comment'
        } = root.config;
        root['config']['path'] = path.replace(/index\.html?$/, '');
        root['config']['clazzName'] = clazzName;
        let ds = _avatarSetting['ds'];
        let force = avatarForce ? '&q=' + Math.random().toString(32).substring(2) : '';
        lang && langMode && root.installLocale(lang, langMode);
        root.locale = root.locale || locales[lang || 'zh-cn'];
        root.notify = notify || false;
        root.verify = verify || false;
        _avatarSetting['params'] = `?d=${(ds.indexOf(avatar) > -1 ? avatar : 'mp')}&v=${VERSION}${force}`;
        _avatarSetting['hide'] = avatar === 'hide' ? true : false;
        _avatarSetting['cdn'] = /^https?\:\/\//.test(avatar_cdn) ? avatar_cdn : _avatarSetting['cdn']

        let size = Number(pageSize || 10);
        root.config.pageSize = !isNaN(size) ? (size < 1 ? 10 : size) : 10;

        marked.setOptions({
            renderer: new marked.Renderer(),
            highlight: root.config.highlight === false ? null : hanabi,
            gfm: true,
            tables: true,
            breaks: true,
            pedantic: false,
            sanitize: true,
            smartLists: true,
            smartypants: true
        });


        if (recordIP) {
                let ipScript = Utils.create('script', 'src', '//api.ip.sb/jsonip?callback=getIP');
                let s = document.getElementsByTagName("script")[0];
                s.parentNode.insertBefore(ipScript, s);
                // 获取IP
                window.getIP = function (json) {
                    defaultComment['ip'] = json.ip;
                }
        }

        let url = root.config.app_url || root.config.appUrl;
        let key = root.config.app_key || root.config.appKey;
        if (!url || !key) throw 99;
        try {
            supabase = client.createClient(url, key)
        } catch (ex) { }

        // get comment count
        let els = Utils.findAll(document, '.valine-comment-count');
        Utils.each(els, (idx, el) => {
            if (el) {
                let k = Utils.attr(el, 'data-xid');
                if (k) {
                    let data = root.Q(k);
                    console.log("comments count: ",data.length)
                    el.innerText = data.length;
                }
            }
        })

        let el = root.config.el || null;
        let _el = Utils.findAll(document, el);
        el = el instanceof HTMLElement ? el : (_el[_el.length - 1] || null);
        if (!el) return;
        root.el = el;
        try{root.el.classList.add('v');}catch(ex){root.el.setAttribute('class',root.el.getAttribute('class')+' v')}

        _avatarSetting['hide'] && root.el.classList.add('hide-avatar');
        root.config.meta = (root.config.guest_info || root.config.meta || META).filter(item => META.indexOf(item) > -1);
        let inputEl = (root.config.meta.length == 0 ? META : root.config.meta).map(item => {
            let _t = item == 'mail' ? 'email' : 'text';
            return META.indexOf(item) > -1 ? `<input name="${item}" placeholder="${root.locale['head'][item]}" class="v${item} vinput" type="${_t}">` : ''
        });
        root.placeholder = root.config.placeholder || 'Just Go Go';

        root.el.innerHTML = `<div class="vwrap"><div class="${`vheader item${inputEl.length}`}">${inputEl.join('')}</div><div class="vedit"><textarea id="veditor" class="veditor vinput" placeholder="${root.placeholder}"></textarea><div class="vctrl"><span class="vemoji-btn">${root.locale['ctrl']['emoji']}</span> | <span class="vpreview-btn">${root.locale['ctrl']['preview']}</span></div><div class="vemojis" style="display:none;"></div><div class="vinput vpreview" style="display:none;"></div></div><div class="vcontrol"><div class="col col-20" title="Markdown is supported"><a href="https://segmentfault.com/markdown" target="_blank"><svg class="markdown" viewBox="0 0 16 16" version="1.1" width="16" height="16" aria-hidden="true"><path fill-rule="evenodd" d="M14.85 3H1.15C.52 3 0 3.52 0 4.15v7.69C0 12.48.52 13 1.15 13h13.69c.64 0 1.15-.52 1.15-1.15v-7.7C16 3.52 15.48 3 14.85 3zM9 11H7V8L5.5 9.92 4 8v3H2V5h2l1.5 2L7 5h2v6zm2.99.5L9.5 8H11V5h2v3h1.5l-2.51 3.5z"></path></svg></a></div><div class="col col-80 text-right"><button type="button" title="Cmd|Ctrl+Enter" class="vsubmit vbtn">${root.locale['ctrl']['reply']}</button></div></div><div style="display:none;" class="vmark"></div></div><div class="vinfo" style="display:none;"><div class="vcount col"></div></div><div class="vlist"></div><div class="vempty" style="display:none;"></div><div class="vpage txt-center"></div><div class="info"><div class="power txt-right">Powered By <a href="https://valine.js.org" target="_blank">Valine</a><br>v${VERSION}</div></div>`;
    

        // Empty Data
        let vempty = Utils.find(root.el, '.vempty');
        root.nodata = {
            show(txt) {
                vempty.innerHTML = txt || root.locale['tips']['sofa'];
                Utils.attr(vempty, 'style', 'display:block;');
                return root;
            },
            hide() {
                Utils.attr(vempty, 'style', 'display:none;');
                return root;
            }
        }
        // loading
        let _spinner = Utils.create('div', 'class', 'vloading');
        // loading control
        let _vlist = Utils.find(root.el, '.vlist');
        root.loading = {
            show(mt) {
                let _vlis = Utils.findAll(_vlist, '.vcard');
                if (mt) _vlist.insertBefore(_spinner, _vlis[0]);
                else _vlist.appendChild(_spinner);
                root.nodata.hide();
                return root;
            },
            hide() {
                let _loading = Utils.find(_vlist, '.vloading');
                if (_loading) Utils.remove(_loading);
                Utils.findAll(_vlist, '.vcard').length === 0 && root.nodata.show()
                return root;
            }
        };
        // alert
        let _mark = Utils.find(root.el, '.vmark');
        root.alert = {
            /**
             * {
             *  type:0/1,
             *  text:'',
             *  ctxt:'',
             *  otxt:'',
             *  cb:fn
             * }
             *
             * @param {Object} o
             */
            show(o) {
                _mark.innerHTML = `<div class="valert txt-center"><div class="vtext">${o && o.text || 1}</div><div class="vbtns"></div></div>`;
                let _vbtns = Utils.find(_mark, '.vbtns');
                let _cBtn = `<button class="vcancel vbtn">${ o && o.ctxt || root.locale['ctrl']['cancel'] }</button>`;
                let _oBtn = `<button class="vsure vbtn">${ o && o.otxt || root.locale['ctrl']['sure'] }</button>`;
                _vbtns.innerHTML = `${_cBtn}${o && o.type && _oBtn}`;
                Utils.on('click', Utils.find(_mark, '.vcancel'), (e) => {
                    root.alert.hide();
                })
                Utils.attr(_mark, 'style', 'display:block;');
                if (o && o.type) {
                    let _ok = Utils.find(_mark, '.vsure');
                    Utils.on('click', _ok, (e) => {
                        root.alert.hide();
                        o.cb && o.cb();
                    });
                }
                return root;
            },
            hide() {
                Utils.attr(_mark, 'style', 'display:none;');
                return root;
            }
        }

        // Bind Event
        root.bind();

    } catch (ex) {
        root.ErrorHandler(ex,'init')
    }
}

ValineFactory.prototype.Q = function (k) {
    console.log("ValineFactory.prototype.Q ");
    let root = this;
    let len = arguments.length;
    var query
    if (len == 1) {
        if (k === '*') {
            query = supabase.from('comments')
            .select()
            .eq('rid', '')
            .neq('url','')
        } else {
            query = supabase.from('comments')
            .select()
            .eq('rid', '')
            .eq('url',decodeURI(k))
        }
        query = query.order('createdat',{ ascending: false })
                .order('createdat',{ ascending: false });
    } else {
        let ids = arguments[1];
        console.log("ids: ", ids);
        // JSON.stringify(arguments[1]).replace(/(\[|\])/g, '');
        query =  supabase.from('comments')
        .select()
        .in('rid', ids)
        .order('createdat',{ ascending: false })
    }

    return query;
}

ValineFactory.prototype.ErrorHandler = function (ex,origin) {
    console.log(origin)
    console.error(ex)
    console.error(ex.code,ex.message)
    let root = this;
    root.el && root.loading.hide().nodata.hide()
    if (({}).toString.call(ex) === "[object Error]") {
        let code = ex.code || '',
            t = root.locale['error'][code],
            msg = t || ex.message || ex.error || '';
        if (code == 101) root.nodata.show()
        else root.el && root.nodata.show(`<pre style="text-align:left;">Code ${code}: ${msg}</pre>`) ||
            console && console.error(`Code ${code}: ${msg}`)
    } else {
        root.el && root.nodata.show(`<pre style="text-align:left;">${JSON.stringify(ex)}</pre>`) ||
            console && console.error(JSON.stringify(ex))
    }
    return;
}

/**
 * install Multi language support
 * @param {String} locale langName
 * @param {Object} mode langSource
 */
ValineFactory.prototype.installLocale = function (locale, mode) {
    let root = this;
    mode = mode || {};
    if (locale) {
        // locales[locale] = JSON.stringify(Object.keys(locales['zh-cn']))==JSON.stringify(Object.keys(mode)) ? mode : undefined;
        locales[locale] = mode;
        root.locale = locales[locale] || locales['zh-cn'];
    }
    return root;
}

/**
 * 
 * @param {String} path 
 */
ValineFactory.prototype.setPath = function (path) {
    this.config.path = path
    return this
}

/**
 * Bind Event
 */
ValineFactory.prototype.bind = function (option) {
    let root = this;

    // load emojis
    let _vemojis = Utils.find(root.el, '.vemojis');
    let _vpreview = Utils.find(root.el, '.vpreview');
    // emoji 操作
    let _emojiCtrl = Utils.find(root.el, '.vemoji-btn');
    // 评论内容预览
    let _vpreviewCtrl = Utils.find(root.el, `.vpreview-btn`);
    let _veditor = Utils.find(root.el, '.veditor');
    let emojiData = Emoji.data;
    for (let key in emojiData) {
        if (emojiData.hasOwnProperty(key)) {
            (function (name, val) {
                let _i = Utils.create('i', {
                    'name': name,
                    'title': name
                });
                _i.innerHTML = val;
                _vemojis.appendChild(_i);
                Utils.on('click', _i, (e) => {
                    _insertAtCaret(_veditor, val)
                    syncContentEvt(_veditor)
                });
            })(key, emojiData[key])
        }
    }

    root.emoji = {
        show() {
            root.preview.hide();
            Utils.attr(_emojiCtrl, 'v', 1);
            Utils.removeAttr(_vpreviewCtrl, 'v');
            Utils.attr(_vemojis, 'style', 'display:block');
            return root.emoji
        },
        hide() {
            Utils.removeAttr(_emojiCtrl, 'v');
            Utils.attr(_vemojis, 'style', 'display:hide');
            return root.emoji
        }
    }
    root.preview = {
        show() {
            if (defaultComment['comment']) {
                root.emoji.hide();
                Utils.attr(_vpreviewCtrl, 'v', 1);
                Utils.removeAttr(_emojiCtrl, 'v');
                _vpreview.innerHTML = defaultComment['comment'];
                Utils.attr(_vpreview, 'style', 'display:block');
                _activeOtherFn()
            }
            return root.preview
        },
        hide() {
            Utils.removeAttr(_vpreviewCtrl, 'v');
            Utils.attr(_vpreview, 'style', 'display:none');
            return root.preview
        },
        empty() {
            _vpreview.innerHtml = '';
            return root.preview
        }
    }

    /**
     * XSS filter
     * @param {String} content Html String
     */
    let xssFilter = (content) => {
        let vNode = Utils.create('div');
        vNode.insertAdjacentHTML('afterbegin', content);
        let ns = Utils.findAll(vNode, "*");
        let rejectNodes = ['INPUT', 'STYLE', 'SCRIPT', 'IFRAME', 'FRAME', 'AUDIO', 'VIDEO', 'EMBED', 'META', 'TITLE', 'LINK'];
        let __replaceVal = (node, attr) => {
            let val = Utils.attr(node, attr);
            val && Utils.attr(node, attr, val.replace(/(javascript|eval)/ig, ''));
        }
        Utils.each(ns, (idx, n) => {
            if (n.nodeType !== 1) return;
            if (rejectNodes.indexOf(n.nodeName) > -1) {
                if (n.nodeName === 'INPUT' && Utils.attr(n, 'type') === 'checkbox') Utils.attr(n, 'disabled', 'disabled');
                else Utils.remove(n);
            }
            if (n.nodeName === 'A') __replaceVal(n, 'href')
            Utils.clearAttr(n)
        })

        return vNode.innerHTML
    }

    /**
     * 评论框内容变化事件
     * @param {HTMLElement} el 
     */
    let syncContentEvt = (_el) => {
        let _v = 'comment';
        let _val = (_el.value || '');
        _val = Emoji.parse(_val);
        _el.value = _val;
        let ret = xssFilter(marked(_val));
        defaultComment[_v] = ret;
        _vpreview.innerHTML = ret;
        if (_val) autosize(_el);
        else autosize.destroy(_el)
    }

    // 显示/隐藏 Emojis
    Utils.on('click', _emojiCtrl, (e) => {
        let _vi = Utils.attr(_emojiCtrl, 'v');
        if (_vi) root.emoji.hide()
        else root.emoji.show();
    });

    Utils.on('click', _vpreviewCtrl, function (e) {
        let _vi = Utils.attr(_vpreviewCtrl, 'v');
        if (_vi) root.preview.hide();
        else root.preview.show();
    });

    let meta = root.config.meta;
    let inputs = {};

    // 同步操作
    let mapping = {
        veditor: "comment"
    }
    for (let i = 0, len = meta.length; i < len; i++) {
        mapping[`v${meta[i]}`] = meta[i];
    }
    for (let i in mapping) {
        if (mapping.hasOwnProperty(i)) {
            let _v = mapping[i];
            let _el = Utils.find(root.el, `.${i}`);
            inputs[_v] = _el;
            _el && Utils.on('input change blur', _el, (e) => {
                if (_v === 'comment') syncContentEvt(_el)
                else defaultComment[_v] = Utils.escape(_el.value.replace(/(^\s*)|(\s*$)/g, "")).substring(0,20);
            });
        }
    }

    let _insertAtCaret = (field, val) => {
        if (document.selection) {
            //For browsers like Internet Explorer
            field.focus();
            let sel = document.selection.createRange();
            sel.text = val;
            field.focus();
        } else if (field.selectionStart || field.selectionStart == '0') {
            //For browsers like Firefox and Webkit based
            let startPos = field.selectionStart;
            let endPos = field.selectionEnd;
            let scrollTop = field.scrollTop;
            field.value = field.value.substring(0, startPos) + val + field.value.substring(endPos, field.value.length);
            field.focus();
            field.selectionStart = startPos + val.length;
            field.selectionEnd = startPos + val.length;
            field.scrollTop = scrollTop;
        } else {
            field.focus();
            field.value += val;
        }
    }
    let createVquote = id => {
        let vcontent = Utils.find(root.el, ".vh[rootid='" + id + "']");
        let vquote = Utils.find(vcontent, '.vquote');
        if (!vquote) {
            vquote = Utils.create('div', 'class', 'vquote');
            vcontent.appendChild(vquote);
        }
        return vquote
    }

    let queryComments = async(no = 1) =>{
        let size = root.config.pageSize;
        let count = Number(Utils.find(root.el, '.vnum').innerText);
        root.loading.show();
        let query = root.Q(root.config.path);
        
        let {data, error} = await query;
        if (error) {
            console.log(error.message);
            return
        }
        console.log("data: ", data)
        let begin = (no - 1) * size;
        let end = data.length < begin+size ? data.length:begin+size;
        let rets = data.slice(begin, end);
        let len = rets.length;
        let rids = []
        for (let i = 0; i < len; i++) {
            let ret = rets[i];
            rids.push(ret.id)
            let old_data = ret.createdat;
            ret.createdat = new Date(Date.parse(old_data))
            insertDom(ret, Utils.find(root.el, '.vlist'), !0)
        }
        // load children comment
        if (rids.length > 0 ) {
            let query = root.Q(root.config.path, rids)
            let {data, error} = await query;
            if (error) {
                console.log(error.message);
                return
            }
            console.log('data: ', data)
            let childs = data || []
            for (let k = 0; k < childs.length; k++) {
                let child = childs[k];
                child.createdat = new Date(Date.parse(child.createdat))
                insertDom(child, createVquote(child.rid))
            }
        }

        let _vpage = Utils.find(root.el, '.vpage');
        _vpage.innerHTML = size * no < count ? `<button type="button" class="vmore vbtn">${root.locale['ctrl']['more']}</button>` : '';
        let _vmore = Utils.find(_vpage, '.vmore');
        if (_vmore) {
            Utils.on('click', _vmore, (e) => {
                _vpage.innerHTML = '';
                queryComments(++no);
            })
        }
        root.loading.hide();
        // }).catch(ex => {
        //     root.loading.hide().ErrorHandler(ex,'query')
        // })
    }

    let getComments = async() => {
        let query = root.Q(root.config.path);
        let {data, error} = await query;
        if (error) {
            console.log(error.message);
            return
        }
        let num = data.length;
        if (num > 0) {
            Utils.attr(Utils.find(root.el, '.vinfo'), 'style', 'display:block;');
            Utils.find(root.el, '.vcount').innerHTML = `<span class="vnum">${num}</span> ${root.locale['tips']['comments']}`;
            queryComments();
        } else {
            root.loading.hide();
        }
    }
    getComments();


    let insertDom = (rt, node, mt) => {
        let rootid = rt.rid || rt.id;
        let _vcard = Utils.create('div', {
            'class': 'vcard',
            'id': rt.id
        });
        let _img = _avatarSetting['hide'] ? '' : `<img class="vimg" src="${_avatarSetting['cdn']+md5(rt.mail)+_avatarSetting['params']}">`;
        let ua = rt.ua || '';
        let uaMeta = '';
        if (ua) {
            ua = detect(ua);
            let browser = `<span class="vsys">${ua.browser} ${ua.version}</span>`;
            let os = `<span class="vsys">${ua.os} ${ua.osVersion}</span>`;
            uaMeta = `${browser} ${os}`;
        }
        if(root.config.path === '*') uaMeta = `<a href="${rt.url}" class="vsys">${rt.url}</a>`
        let _nick = '';
        let _t = rt.link?(/^https?\:\/\//.test(rt.link) ? rt.link : 'http://'+rt.link) : '';
        _nick = _t ? `<a class="vnick" rel="nofollow" href="${_t}" target="_blank" >${rt.nick}</a>` : `<span class="vnick">${rt.nick}</span>`;
        _vcard.innerHTML = `${_img}
            <div class="vh" rootid=${rootid}>
                <div class="vhead">${_nick} ${uaMeta}</div>
                <div class="vmeta">
                    <span class="vtime">${timeAgo(rt.createdat || rt.createdAt,root.locale)}</span>
                    <span class="vat">${root.locale['ctrl']['reply']}</span>
                </div>
                <div class="vcontent">
                    ${xssFilter(rt.comment)}
                </div>
            </div>`;
        let _vat = Utils.find(_vcard, '.vat');
        let _as = Utils.findAll(_vcard, 'a');
        for (let i = 0, len = _as.length; i < len; i++) {
            let _a = _as[i];
            if (_a && (Utils.attr(_a, 'class') || '').indexOf('at') == -1) {
                Utils.attr(_a, {
                    'target': '_blank',
                    'rel': 'nofollow'
                });
            }
        }
        let _vlis = Utils.findAll(node, '.vcard');
        if (mt) node.appendChild(_vcard);
        else node.insertBefore(_vcard, _vlis[0]);
        let _vcontent = Utils.find(_vcard, '.vcontent');
        if (_vcontent) expandEvt(_vcontent);
        if (_vat) bindAtEvt(_vat, rt);
        _activeOtherFn()

    }


    let _activeOtherFn = () => {
        setTimeout(function () {
            try {
                // let MathJax = MathJax || '';
                typeof MathJax !== 'undefined' && MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
                if (typeof hljs !== 'undefined') {
                    Utils.each(Utils.findAll('pre code'), function (i, block) {
                        hljs.highlightBlock(block);
                    })
                    Utils.each(Utils.findAll('code.hljs'), function (i, block) {
                        hljs.lineNumbersBlock(block);
                    });
                }
            } catch (ex) {}
        }, 200)
    }

    // expand event
    let expandEvt = (el) => {
        setTimeout(function () {
            if (el.offsetHeight > 180) {
                el.classList.add('expand');
                Utils.on('click', el, e => {
                    Utils.attr(el, 'class', 'vcontent');
                })
            }
        })
    }

    let atData = {}
    // at event
    let bindAtEvt = (el, rt) => {
        Utils.on('click', el, (e) => {
            let at = `@${Utils.escape(rt.nick)}`;
            atData = {
                'at': Utils.escape(at) + ' ',
                'rid': rt.rid || rt.id,
                'pid': rt.id,
                'rmail': rt.mail,
            }
            Utils.attr(inputs['comment'], 'placeholder', at);
            inputs['comment'].focus();
        })
    }

    // cache
    let getCache = () => {
        let s = _store && _store.ValineCache;
        if (s) {
            s = JSON.parse(s);
            let m = meta;
            for (let i in m) {
                let k = m[i];
                Utils.find(root.el, `.v${k}`).value = Utils.unescape(s[k]);
                defaultComment[k] = s[k];
            }
        }
    }
    getCache();
    // reset form
    let reset = () => {
        defaultComment['comment'] = "";
        inputs['comment'].value = "";
        syncContentEvt(inputs['comment'])
        Utils.attr(inputs['comment'], 'placeholder', root.placeholder);
        atData = {};
        root.preview.empty().hide();
    }

    // submitsubmit
    let submitBtn = Utils.find(root.el, '.vsubmit');
    let submitEvt = (e) => {
        if (Utils.attr(submitBtn, 'disabled')) {
            root.alert.show({
                type: 0,
                text: `${root.locale['tips']['busy']}ヾ(๑╹◡╹)ﾉ"`,
                ctxt: root.locale['ctrl']['ok']
            })
            return;
        }
        if (defaultComment['nick'].length < 3) {
            inputs['nick'].focus();
            return;
        }
        if (defaultComment['mail'].length < 6 || defaultComment['mail'].indexOf('@') < 1 || defaultComment['mail'].indexOf('.') < 3) {
            inputs['mail'].focus();
            return;
        }
        if (defaultComment['comment'] == '') {
            inputs['comment'].focus();
            return;
        }
        defaultComment['nick'] = defaultComment['nick'] || 'Anonymous';

        // return;
        if (root.notify || root.verify) {
            verifyEvt(commitEvt)
        } else {
            commitEvt();
        }
    }

    // setting access
    // let getAcl = () => {
    //     let acl = new AV.ACL();
    //     acl.setPublicReadAccess(!0);
    //     acl.setPublicWriteAccess(!1);
    //     return acl;
    // }

    let commitEvt = () => {
        Utils.attr(submitBtn, 'disabled', !0);
        root.loading.show(!0);
        var rid = '';
        var pid = '';

        let comment = new Comment();
        comment.url = decodeURI(root.config.path);
        comment.createdat = new Date();
        if (atData['rid']) {
            pid = atData['pid'] || atData['rid'];
            rid = atData['rid'];
            comment['comment'] = comment['comment'].replace('<p>', `<p><a class="at" href="#${pid}">${atData['at']}</a> , `);
        }
        comment.nick = defaultComment['nick'];
        comment.pid = pid;
        comment.rid = rid;
        comment.id = guid()
        insertComment(comment);
        let ret = comment;
        defaultComment['nick'] != 'Anonymous' && _store && _store.setItem('ValineCache', JSON.stringify({
            nick: defaultComment['nick'],
            link: defaultComment['link'],
            mail: defaultComment['mail']
        }));
        let _count = Utils.find(root.el, '.vnum');
        let num = 1;
        try {
            if (atData['rid']) {
                let vquote = Utils.find(root.el, '.vquote[rid="' + atData['rid'] + '"]') || createVquote(atData['rid']);
                insertDom(ret, vquote, !0)
            } else {
                if (_count) {
                    num = Number(_count.innerText) + 1;
                    _count.innerText = num;
                } else {
                    Utils.find(root.el, '.vcount').innerHTML = '<span class="num">1</span> ' + root.locale['tips']['comments']
                }
                insertDom(ret, Utils.find(root.el, '.vlist'));
                root.config.pageSize++
            }

            defaultComment['mail'] && signUp({
                username: defaultComment['nick'],
                mail: defaultComment['mail']
            });

            atData['at'] && atData['rmail'] && root.notify && mailEvt({
                username: atData['at'].replace('@', ''),
                mail: atData['rmail']
            });
            Utils.removeAttr(submitBtn, 'disabled');
            root.loading.hide();
            reset();
        } catch (ex) {
            root.ErrorHandler(ex,'save');
        }
    }

    let verifyEvt = (fn) => {
        let x = Math.floor((Math.random() * 10) + 1);
        let y = Math.floor((Math.random() * 10) + 1);
        let z = Math.floor((Math.random() * 10) + 1);
        let opt = ['+', '-', 'x'];
        let o1 = opt[Math.floor(Math.random() * 3)];
        let o2 = opt[Math.floor(Math.random() * 3)];
        let expre = `${x}${o1}${y}${o2}${z}`;
        let subject = `${expre} = <input class='vcode vinput' >`;
        root.alert.show({
            type: 1,
            text: subject,
            ctxt: root.locale['ctrl']['cancel'],
            otxt: root.locale['ctrl']['ok'],
            cb() {
                let code = +Utils.find(root.el, '.vcode').value;
                let ret = (new Function(`return ${expre.replace(/x/g, '*')}`))();
                if (ret === code) {
                    fn && fn();
                } else {
                    root.alert.show({
                        type: 1,
                        text: `(T＿T)${root.locale['tips']['again']}`,
                        ctxt: root.locale['ctrl']['cancel'],
                        otxt: root.locale['ctrl']['try'],
                        cb() {
                            verifyEvt(fn);
                            return;
                        }
                    })
                }
            }
        })
    }

    let signUp = (o) => {
        const { user, session, error } = supabase.auth.signUp({
            email: o.mail,
            password: o.mail,
          });
        return user;
        // let u = new AV.User();
        // u.setUsername(o.username);
        // u.setPassword(o.mail);
        // u.setEmail(o.mail);
        // // u.setACL(getAcl());
        // return u.signUp();
    }

    let mailEvt = (o) => {
        supabase.auth.api.resetPasswordForEmail(o.mail).then(ret => {}).catch(e => {
            if (e.code == 1) {
                root.alert.show({
                    type: 0,
                    text: `ヾ(ｏ･ω･)ﾉ At太频繁啦，提醒功能暂时宕机。<br>${e.error}`,
                    ctxt: root.locale['ctrl']['ok']
                })
            } else {
                signUp(o).then(ret => {
                    mailEvt(o);
                }).catch(x => {
                    //err(x)
                })
            }
        })
    }
    Utils.on('click', submitBtn, submitEvt);
    Utils.on('keydown', document, function (e) {
        e = event || e;
        let keyCode = e.keyCode || e.which || e.charCode;
        let ctrlKey = e.ctrlKey || e.metaKey;
        // Shortcut key
        ctrlKey && keyCode === 13 && submitEvt()
        // tab key
        if (keyCode === 9) {
            let focus = document.activeElement.id || ''
            if (focus == 'veditor') {
                e.preventDefault();
                _insertAtCaret(_veditor, '    ');
            }
        }
    });
    Utils.on('paste',document,(e)=>{
        let clipboardData = "clipboardData" in e ? e.clipboardData : (e.originalEvent && e.originalEvent.clipboardData || window.clipboardData)
        let items = clipboardData && clipboardData.items;
        let files = [];
        if (items && items.length>0) {
            // 检索剪切板items
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    files.push(items[i].getAsFile());
                    break;
                }
            }
            if(files.length) {
                for(let idx in files){
                    let file = files[idx],
                        uploadText = `![Uploading ${file['name']}]()`;
                    _insertAtCaret(_veditor, uploadText);
                    file && uploadImage(file,function(err,ret){
                        if(!err && ret) _veditor.value = _veditor.value.replace(uploadText,`\r\n![${file['name']}](${ret['data']})`)
                    })
                }
            }
        }

    })


    let uploadImage = (file,callback)=>{
        let formData = new FormData();
        formData.append('file', file);
        let xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4 && xhr.status == 200) {
                try {
                    let json = JSON.parse(xhr.responseText);
                    callback && callback(null,json)
                } catch (err) {
                    callback && callback(err)
                }
            } else {
                callback && callback(xhr.status)
            }
        }
        xhr.onerror = function(e){
            console.log(e)
        }
    }

}

function Valine(options) {
    return new ValineFactory(options)
}

module.exports = Valine;
module.exports.default = Valine;
