// PageNotes Content Script v1.04
// Fixes: 標記重新連接後保留、SPA懶加載支援、smart retry
(function(){
'use strict';
var toolbar=null,fab=null,fabMenu=null;
var notesOnPage={},minimizedNotes={},_highlights=[];
var _lang='zh-TW';
try{chrome.storage.local.get('lang',function(r){if(r&&r.lang)_lang=r.lang;});}catch(e){}
function L(zh,en){return _lang==='en'?en:zh;}

// ── Styles ─────────────────────────────────────────────
function injectStyles(){
if(document.getElementById('pn-css'))return;
var s=document.createElement('style');s.id='pn-css';
s.textContent=[
'.pn-fab{position:fixed;bottom:24px;right:24px;width:52px;height:52px;border-radius:50%;border:none;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:white;cursor:pointer;z-index:2147483646;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(99,102,241,.4);}',
'.pn-fab:hover{transform:scale(1.08);}',
'.pn-fab:active{transform:scale(.95);}',
'.pn-fab-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;background:#EF4444;color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px;pointer-events:none;}',
'.pn-fab-menu{position:fixed;bottom:86px;right:16px;z-index:2147483645;display:none;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto;padding:8px;background:rgba(255,255,255,.98);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.18);min-width:220px;}',
'.pn-fab-menu.is-open{display:flex;}',
'.pn-toolbar{position:fixed;z-index:2147483645;display:none;flex-direction:column;gap:4px;padding:8px;background:rgba(255,255,255,.98);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.15);}',
'.pn-toolbar-btn{width:36px;height:36px;border:none;border-radius:8px;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;}',
'.pn-toolbar-btn:hover{background:#EEF2FF;}',
'.pn-card{position:fixed;z-index:2147483640;min-width:240px;max-width:400px;background:rgba(255,255,255,.97);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.12);cursor:default;overflow:hidden;}',
'.pn-card:hover{box-shadow:0 12px 48px rgba(0,0,0,.18);}',
'.pn-card.is-pinned{box-shadow:0 0 0 2px #F59E0B,0 8px 32px rgba(0,0,0,.12);}',
'.pn-card-header{display:flex;align-items:center;gap:6px;padding:10px 12px 8px;border-bottom:1px solid rgba(0,0,0,.06);cursor:grab;}',
'.pn-card-title{font-size:12px;font-weight:600;color:#475569;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
'.pn-card-actions{display:flex;gap:4px;opacity:0;}',
'.pn-card:hover .pn-card-actions{opacity:1;}',
'.pn-card-btn{width:26px;height:26px;border:none;border-radius:6px;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#94A3B8;}',
'.pn-card-btn:hover{background:#F1F5F9;color:#1E293B;}',
'.pn-card-body{padding:10px 12px 12px;min-height:60px;}',
'.pn-card-body textarea{width:100%;min-height:80px;border:none;outline:none;resize:none;font-family:Inter,sans-serif;font-size:13px;line-height:1.6;color:#1E293B;background:transparent;box-sizing:border-box;padding:0;}',
'.pn-card-footer{padding:6px 12px 8px;border-top:1px solid rgba(0,0,0,.05);display:flex;align-items:center;justify-content:space-between;}',
'.pn-card-url{font-size:10px;color:#94A3B8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
'.pn-card-time{font-size:10px;color:#CBD5E1;}',
'.pn-confirm{position:absolute;inset:0;background:rgba(255,255,255,.98);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:10;}',
'.pn-hl-yellow{background:#FEF08A!important;cursor:pointer;}',
'.pn-hl-yellow:hover{background:#FDE047!important;}',
'.pn-hl-green{background:#BBF7D0!important;cursor:pointer;}',
'.pn-hl-green:hover{background:#86EFAC!important;}',
'.pn-hl-pink{background:#FBCFE8!important;cursor:pointer;}',
'.pn-hl-pink:hover{background:#F9A8D4!important;}',
'.pn-toast{position:fixed;bottom:88px;right:24px;z-index:2147483647;background:#1E293B;color:white;padding:8px 16px;border-radius:8px;font-size:12px;opacity:0;transition:opacity .2s;pointer-events:none;}'
].join('');
document.head.appendChild(s);
}

// ── FAB ───────────────────────────────────────────────
function centerX(){return window.innerWidth/2-140;}
function centerY(){return window.innerHeight/2-60;}

function createFAB(){
if(document.getElementById('pn-fab'))return;
fabMenu=document.createElement('div');fabMenu.id='pn-fab-menu';fabMenu.className='pn-fab-menu';
document.body.appendChild(fabMenu);
fab=document.createElement('button');fab.id='pn-fab';fab.className='pn-fab';
fab.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" width="22" height="22"><path d="M12 5v14M5 12h14"/></svg>';
document.body.appendChild(fab);
fab.addEventListener('click',function(e){e.stopPropagation();Object.keys(minimizedNotes).length>0?toggleFabMenu():doAddNoteCenter();});
document.addEventListener('click',function(e){if(fabMenu&&fabMenu.classList.contains('is-open')&&!fabMenu.contains(e.target)&&e.target!==fab)fabMenu.classList.remove('is-open');});
}

function toggleFabMenu(){if(!fabMenu)return;fabMenu.classList.contains('is-open')?fabMenu.classList.remove('is-open'):(renderFabMenu(),fabMenu.classList.add('is-open'));}

function renderFabMenu(){
if(!fabMenu)return;
var ids=Object.keys(minimizedNotes);
var html='<div style="font-size:11px;font-weight:600;color:#94A3B8;padding:8px;">'+L('縮小的筆記','Minimized')+' ('+ids.length+')</div>';
ids.forEach(function(id){
var n=minimizedNotes[id];
html+='<button data-restore="'+id+'" style="display:flex;align-items:center;gap:8px;padding:8px;width:100%;border:none;background:transparent;cursor:pointer;text-align:left;">'+
'<span style="flex:1;font-size:12px;">'+escHtml((n.content||'').slice(0,30))+'</span></button>';
});
html+='<button id="pn-add-btn" style="display:flex;align-items:center;gap:8px;padding:8px;width:100%;border:none;background:transparent;cursor:pointer;text-align:left;border-top:1px solid #eee;">'+
'<span style="font-size:12px;color:#6366F1;">+ '+L('新增筆記','Add Note')+'</span></button>';
fabMenu.innerHTML=html;
fabMenu.querySelectorAll('[data-restore]').forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();restoreNote(b.getAttribute('data-restore'));fabMenu.classList.remove('is-open');});});
var ab=fabMenu.querySelector('#pn-add-btn');if(ab)ab.addEventListener('click',function(e){e.stopPropagation();fabMenu.classList.remove('is-open');doAddNoteCenter();});
}

function updateFabBadge(){var b=fab&&fab.querySelector('.pn-fab-badge');if(b)b.remove();var c=Object.keys(minimizedNotes).length;if(c>0&&fab){var bd=document.createElement('span');bd.className='pn-fab-badge';bd.textContent=c;fab.appendChild(bd);}}

function minimizeNote(id){var c=notesOnPage[id];if(!c)return;var n=c.note;n.isMinimized=true;minimizedNotes[id]=n;c.el.style.opacity='0';setTimeout(function(){if(c.el.parentNode)c.el.parentNode.removeChild(c.el);},200);delete notesOnPage[id];chrome.runtime.sendMessage({type:'UPDATE_NOTE',id:id,updates:{isMinimized:true}});updateFabBadge();toast(L('已縮小','Minimized'));}
function restoreNote(id){var n=minimizedNotes[id];if(!n)return;delete minimizedNotes[id];chrome.runtime.sendMessage({type:'UPDATE_NOTE',id:id,updates:{isMinimized:false}});n.x=centerX();n.y=centerY();renderCard(n,true);updateFabBadge();}

// ── Toolbar ─────────────────────────────────────────────
function createToolbar(){
if(document.getElementById('pn-toolbar'))return;
toolbar=document.createElement('div');toolbar.id='pn-toolbar';toolbar.className='pn-toolbar';
toolbar.innerHTML=
'<button class="pn-toolbar-btn" id="pn-hly" title="Yellow"><span style="display:inline-block;width:18px;height:18px;background:#FEF08A;border-radius:4px;"></span></button>'+
'<button class="pn-toolbar-btn" id="pn-hlg" title="Green"><span style="display:inline-block;width:18px;height:18px;background:#BBF7D0;border-radius:4px;"></span></button>'+
'<button class="pn-toolbar-btn" id="pn-hlp" title="Pink"><span style="display:inline-block;width:18px;height:18px;background:#FBCFE8;border-radius:4px;"></span></button>';
toolbar.querySelector('#pn-hly').addEventListener('click',function(e){e.stopPropagation();doHighlight('yellow');hideToolbar();});
toolbar.querySelector('#pn-hlg').addEventListener('click',function(e){e.stopPropagation();doHighlight('green');hideToolbar();});
toolbar.querySelector('#pn-hlp').addEventListener('click',function(e){e.stopPropagation();doHighlight('pink');hideToolbar();});
document.body.appendChild(toolbar);
}

function showToolbar(x,y){var sel=window.getSelection();if(!sel||!sel.toString().trim()){hideToolbar();return;}if(!toolbar)createToolbar();toolbar.style.display='flex';toolbar.style.left=Math.min(Math.max(x-60,8),window.innerWidth-200)+'px';toolbar.style.top=(y-60<8?y+20:y-60)+'px';}
function hideToolbar(){if(toolbar)toolbar.style.display='none';}
document.addEventListener('mouseup',function(e){if((toolbar&&toolbar.contains(e.target))||(fab&&fab.contains(e.target)))return;setTimeout(function(){var sel=window.getSelection();if(sel&&sel.toString().trim().length>0){var r=sel.getRangeAt(0).getBoundingClientRect();showToolbar(r.left+r.width/2,r.top);}else hideToolbar();},10);});
document.addEventListener('mousedown',function(e){if(toolbar&&!toolbar.contains(e.target))hideToolbar();});

// ── Actions ─────────────────────────────────────────────
function doHighlight(color){
var sel=window.getSelection();if(!sel||!sel.toString().trim())return;
var text=sel.toString(),range=sel.getRangeAt(0);
var span=document.createElement('span');
span.className='pn-hl-'+color;
span.setAttribute('data-pn-hl','true');
span.textContent=text;
range.deleteContents();range.insertNode(span);
window.getSelection().removeAllRanges();
chrome.runtime.sendMessage({type:'CREATE_HIGHLIGHT',data:{pageUrl:location.href,text:text,color:color}},function(hl){if(hl&&hl.id)span.setAttribute('data-hl-id',hl.id);});
toast(L('已標記','Highlighted'));
}

function doAddNoteCenter(){var n={pageUrl:location.href,pageTitle:document.title,content:'',x:centerX(),y:centerY(),width:280,color:'white',zIndex:2147483640,isPinned:false,isMinimized:false};chrome.runtime.sendMessage({type:'CREATE_NOTE',data:n},function(s){if(s)renderCard(s,true);});}

// ── Note Card ───────────────────────────────────────────
function renderCard(note,focus){
if(notesOnPage[note.id]){bringToFront(note.id);if(focus)refreshCard(notesOnPage[note.id].el,note,true);return;}
var card=document.createElement('div');
card.className='pn-card'+(note.isPinned?' is-pinned':'');
card.id='pn-card-'+note.id;
card.style.left=(note.x||100)+'px';
card.style.top=(note.y||100)+'px';
card.style.width=(note.width||280)+'px';
card.innerHTML=
'<div class="pn-card-header"><span class="pn-card-title">'+escHtml(note.pageTitle||location.hostname||'')+'</span>'+
'<div class="pn-card-actions">'+
'<button class="pn-card-btn pin-btn">📌</button>'+
'<button class="pn-card-btn min-btn">−</button>'+
'<button class="pn-card-btn del-btn">×</button>'+
'</div></div>'+
'<div class="pn-card-body"></div>'+
'<div class="pn-card-footer"><span class="pn-card-url">'+escHtml((note.pageUrl||'').slice(0,40))+'</span><span class="pn-card-time">'+fmtTime(note.updatedAt)+'</span></div>';
notesOnPage[note.id]={el:card,note:note};
document.body.appendChild(card);
bindCard(card,note);
refreshCard(card,note,!!focus);
}

function bringToFront(id){var c=notesOnPage[id];if(!c)return;var m=2147483640;Object.keys(notesOnPage).forEach(function(k){if(k!==id)m=Math.max(m,parseInt(notesOnPage[k].el.style.zIndex||0,10));});c.el.style.zIndex=m+1;}

function refreshCard(card,note,edit){
var b=card.querySelector('.pn-card-body');if(!b)return;
if(edit){
b.innerHTML='<textarea placeholder="'+L('寫下筆記...','Write note...')+'">'+escHtml(note.content||'')+'</textarea>';
var ta=b.querySelector('textarea');ta.focus();ta.select();
ta.addEventListener('blur',function(){
note.content=ta.value;note.updatedAt=Date.now();
chrome.runtime.sendMessage({type:'UPDATE_NOTE',id:note.id,updates:{content:ta.value,updatedAt:note.updatedAt}});
refreshCard(card,note,false);
});
ta.addEventListener('keydown',function(e){if(e.key==='Escape')ta.blur();});
}else{
b.innerHTML='<div style="font-size:13px;color:#1E293B;min-height:40px;cursor:text;">'+
(note.content?escHtml(note.content):'<span style="color:#94A3B8">'+L('點擊編輯','Click to edit')+'</span>')+'</div>';
b.querySelector('div').addEventListener('click',function(){refreshCard(card,note,true);});
}
}

function bindCard(card,note){
var h=card.querySelector('.pn-card-header');
makeDraggable(card,h);
card.addEventListener('mousedown',function(){bringToFront(note.id);});
card.querySelector('.pin-btn').addEventListener('click',function(e){e.stopPropagation();
note.isPinned=!note.isPinned;card.classList.toggle('is-pinned',note.isPinned);
chrome.runtime.sendMessage({type:'UPDATE_NOTE',id:note.id,updates:{isPinned:note.isPinned}});});
card.querySelector('.min-btn').addEventListener('click',function(e){e.stopPropagation();minimizeNote(note.id);});
card.querySelector('.del-btn').addEventListener('click',function(e){e.stopPropagation();
if(confirm(L('刪除此筆記？','Delete this note?'))){
chrome.runtime.sendMessage({type:'DELETE_NOTE',id:note.id});
card.style.opacity='0';setTimeout(function(){if(card.parentNode)card.parentNode.removeChild(card);},200);
delete notesOnPage[note.id];}});
h.addEventListener('dblclick',function(){refreshCard(card,note,true);});
}

function makeDraggable(el,handle){
var d=false,sx,sy,ox,oy;
handle.addEventListener('mousedown',function(e){
if(e.target.closest('.pn-card-actions'))return;
d=true;el.style.cursor='grabbing';sx=e.clientX;sy=e.clientY;ox=el.offsetLeft;oy=el.offsetTop;e.preventDefault();
});
document.addEventListener('mousemove',function(e){if(!d)return;el.style.left=(ox+e.clientX-sx)+'px';el.style.top=(oy+e.clientY-sy)+'px';});
document.addEventListener('mouseup',function(){
if(!d)return;d=false;el.style.cursor='';
var id=el.id.replace('pn-card-',''),c=notesOnPage[id];
if(c)chrome.runtime.sendMessage({type:'UPDATE_NOTE',id:c.note.id,updates:{x:el.offsetLeft,y:el.offsetTop}});
});
}

// ── Highlights ──────────────────────────────────────────
// _highlights: array of {id, text, color, pageUrl, ...}
// _hlPending: array of {hl, retries}
// _hlObserver: MutationObserver instance
// _hlTimer: retry timer

var _hlPending=[],_hlTimer=null;

function loadHighlights(){
chrome.runtime.sendMessage({type:'GET_HIGHLIGHTS_BY_URL',url:location.href},function(hls){
_highlights=hls||[];
_hlPending=_highlights.map(function(h){return{hl:h,retries:0};});
// 先等待 DOM ready，再嘗試套用
waitForDOM(function(){
applyPendingHighlights();
startHlObserver();
checkUrlHash();
});
});
}

// 等待 DOM 起碼有一秒鐘的穩定時間（給懶加載用的內容時間出現）
function waitForDOM(cb){
var waited=0,interval=100;
function check(){
waited+=interval;
if(document.body&&document.body.childNodes.length>0){cb();return;}
if(waited>8000){cb();return;} // 最多等8秒
setTimeout(check,interval);
}
check();
}

// 嘗試套用所有待處理的標記
// 每次只呼叫一次，內部自己處理 retry
function applyPendingHighlights(){
var applied=[],needsMore=[];
_hlPending.forEach(function(item){
var result=tryApplyHighlight(item.hl);
if(result===true){applied.push(item.hl.id);}
else{needsMore.push(item);}
});
_hlPending=needsMore;
// 有套用到就停止計時器；沒套到但還有pending就排程重試
if(_hlPending.length>0){
if(_hlTimer)clearTimeout(_hlTimer);
_hlTimer=setTimeout(applyPendingHighlights,800);
}
}

// 嘗試套用單一標記
// 回傳 true = 成功套用
// 回傳 false = DOM還沒有這段文字（需要等）
function tryApplyHighlight(hl){
var text=hl.text;if(!text)return false;
// 先檢查頁面是否已有這個標記（頁面重構後content script重跑但DOM沒清的情況）
var existing=document.querySelector('[data-hl-id="'+hl.id+'"]');
if(existing)return true; // 已經有這個標記了，跳過
// TreeWalker 遍歷所有文字節點，找匹配的內容
try{
var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null,false);
var node;
while((node=walker.nextNode())){
var v=node.nodeValue||'';
var idx=v.indexOf(text);
if(idx===-1)continue;
// 找到完全匹配的 text node
var before=v.substring(0,idx);
var after=v.substring(idx+text.length);
var span=document.createElement('span');
span.className='pn-hl-'+hl.color;
span.setAttribute('data-pn-hl','true');
span.setAttribute('data-hl-id',hl.id);
span.textContent=text;
var frag=document.createDocumentFragment();
if(before)frag.appendChild(document.createTextNode(before));
frag.appendChild(span);
if(after)frag.appendChild(document.createTextNode(after));
node.parentNode.replaceChild(frag,node);
return true;
}
}catch(e){}
return false;
}

// MutationObserver：監聽 DOM 變化（懶加載/SPA路由切換），
// 每次變化時重新嘗試套用還沒成功的標記
var _hlObserver=null;
function startHlObserver(){
if(_hlObserver)return;
_hlObserver=new MutationObserver(function(records){
// 只在有新元素加入時才重試
var hasNewNodes=false;
records.forEach(function(r){if(r.addedNodes.length>0)hasNewNodes=true;});
if(!hasNewNodes)return;
if(_hlTimer)clearTimeout(_hlTimer);
_hlTimer=setTimeout(applyPendingHighlights,300);
});
_hlObserver.observe(document.body,{childList:true,subtree:true});
}

// ── URL Hash 處理 ──────────────────────────────────────
function checkUrlHash(){
var h=location.hash;
if(!h||h.indexOf('#pn-hl-')!==0)return;
var hlId=h.replace('#pn-hl-','');
// 等待 DOM 有這個元素
function tryScroll(){
var el=document.querySelector('[data-hl-id="'+hlId+'"]');
if(el){
el.scrollIntoView({behavior:'smooth',block:'center'});
el.style.outline='3px solid #6366F1';
setTimeout(function(){el.style.outline='';},2000);
}else if(_hlPending.some(function(p){return p.hl.id===hlId;})){
// highlight 還沒套上，等一下再試
setTimeout(tryScroll,500);
}
}
setTimeout(tryScroll,1500);
}

// ── Message Listener ───────────────────────────────────
chrome.runtime.onMessage.addListener(function(req){
if(req.type==='SCROLL_TO_HIGHLIGHT'&&req.hlId){
var el=document.querySelector('[data-hl-id="'+req.hlId+'"]');
if(el){
el.scrollIntoView({behavior:'smooth',block:'center'});
el.style.outline='3px solid #6366F1';
setTimeout(function(){el.style.outline='';},2000);
}else{
// 標記還沒套上，註冊等待
if(!_hlPending.some(function(p){return p.hl.id===req.hlId;})){
_hlPending.push({hl:{id:req.hlId},retries:0});
}
if(_hlTimer)clearTimeout(_hlTimer);
_hlTimer=setTimeout(applyPendingHighlights,500);
}
}
if(req.type==='CREATE_NOTE_AT_CENTER')doAddNoteCenter();
});

// ── Load Notes ─────────────────────────────────────────
function loadNotes(){
chrome.runtime.sendMessage({type:'GET_NOTES_BY_URL',url:location.href},function(notes){
if(!notes)return;
notes.forEach(function(n){if(n.isMinimized){minimizedNotes[n.id]=n;}else{renderCard(n,false);}});
updateFabBadge();
});
}

// ── Init ───────────────────────────────────────────────
function init(){
if(document.getElementById('pn-css'))return;
injectStyles();
createFAB();
loadNotes();
loadHighlights(); // 裡面會等 DOM ready
}

// 頁面載入時偵測
if(document.readyState==='loading'){
document.addEventListener('DOMContentLoaded',init);
}else{
// DOM已經ready，立即初始化
setTimeout(init,50);
}

// 鍵盤快捷鍵
document.addEventListener('keydown',function(e){
if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='n'){e.preventDefault();doAddNoteCenter();}
});

// ── Helpers ─────────────────────────────────────────────
function toast(msg){var t=document.querySelector('.pn-toast');if(t)t.remove();t=document.createElement('div');t.className='pn-toast';t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.style.opacity='1';},10);setTimeout(function(){t.style.opacity='0';setTimeout(function(){t.remove();},200);},2000);}
function fmtTime(ts){if(!ts)return'';var d=new Date(ts),diff=Date.now()-d;if(diff<60000)return L('剛剛','Just now');if(diff<3600000)return Math.floor(diff/60000)+L('分','m');if(diff<86400000)return Math.floor(diff/3600000)+L('小時','h');if(diff<604800000)return Math.floor(diff/86400000)+L('天','d');return d.toLocaleDateString(_lang==='en'?'en-US':'zh-TW');}
function escHtml(s){if(!s)return'';return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
})();
