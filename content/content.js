// PageNotes Content Script v1.05
// Fixes:
// - CREATE_HIGHLIGHT: 同步 ID，DOM 立即有 data-hl-id，刷新必保留
// - GET_NOTES/GET_HIGHLIGHTS: SW 一定回應，list 不消失
// - tryApplyHighlight: 忽略空白、normalize whitespace、trim後比對
// - waitForDOM: 用 readyState + MutationObserver 雙重保障
// - MutationObserver: debounce + 重試直到所有 highlights 都套上
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
ids.forEach(function(id){var n=minimizedNotes[id];
html+='<button data-restore="'+id+'" style="display:flex;align-items:center;gap:8px;padding:8px;width:100%;border:none;background:transparent;cursor:pointer;text-align:left;">'+
'<span style="flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+escHtml((n.content||'').slice(0,30))+'</span></button>';});
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
// ★ 同步 ID：DOM 的 data-hl-id 在 SW 回應前就先有值
function doHighlight(color){
var sel=window.getSelection();if(!sel||!sel.toString().trim())return;
var text=sel.toString(),range=sel.getRangeAt(0);
// ★ 先在本地產生同步 ID，馬上寫入 DOM
var localId='hl_'+Date.now()+'_'+Math.floor(Math.random()*99999);
var span=document.createElement('span');
span.className='pn-hl-'+color;
span.setAttribute('data-pn-hl','true');
span.setAttribute('data-hl-id',localId);
span.textContent=text;
range.deleteContents();range.insertNode(span);
window.getSelection().removeAllRanges();
// SW 回來後更新成 DB 正式 ID（如果成功的話）
chrome.runtime.sendMessage({type:'CREATE_HIGHLIGHT',data:{pageUrl:location.href,text:text,color:color}},function(hl){
if(hl&&hl.id&&hl.id!==localId){
// DB 的 ID 和本地不同（幾乎不會發生），更新 DOM
span.setAttribute('data-hl-id',hl.id);
}
});
toast(L('已標記','Highlighted'));
}

function doAddNoteCenter(){var n={pageUrl:location.href,pageTitle:document.title,content:'',x:centerX(),y:centerY(),width:280,color:'white',zIndex:2147483640,isPinned:false,isMinimized:false};chrome.runtime.sendMessage({type:'CREATE_NOTE',data:n},function(s){if(s&&s.note)renderCard(s.note,true);});}

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
document.addEventListener('mouseup',function(){if(!d)return;d=false;el.style.cursor='';
var id=el.id.replace('pn-card-',''),c=notesOnPage[id];
if(c)chrome.runtime.sendMessage({type:'UPDATE_NOTE',id:c.note.id,updates:{x:el.offsetLeft,y:el.offsetTop}});});
}

// ── Highlights ─────────────────────────────────────────
// _highlights: array from DB {id, text, color, pageUrl}
// _hlPending: subset of _highlights not yet successfully applied
// _hlTimer: debounced retry timer

var _hlPending=[],_hlTimer=null,_hlObserver=null;

function loadHighlights(){
chrome.runtime.sendMessage({type:'GET_HIGHLIGHTS_BY_URL',url:location.href},function(hls){
_highlights=hls||[];
// 從 DB 取回的全部當作待處理（即使有重複也只會套到一次）
_hlPending=_highlights.slice();
// 等待 DOM 穩定後開始套用
waitForDOM(function(){
applyAllHighlights();
startHlObserver();
checkUrlHash();
});
});
}

// 等待 DOM ready：頁面 complete 或有實質內容
function waitForDOM(cb){
if(document.readyState==='complete'&&document.body&&document.body.childNodes.length>0){
setTimeout(cb,300);return;
}
var tried=0;
var interval=setInterval(function(){
tried++;
if(document.readyState==='complete'&&document.body&&document.body.childNodes.length>0){
clearInterval(interval);setTimeout(cb,300);return;
}
if(tried>40){clearInterval(interval);cb();} // 最多等4秒
},100);
}

// 嘗試套用所有還沒套上的 highlights
function applyAllHighlights(){
var remaining=[];
_hlPending.forEach(function(hl){
if(tryApplyHighlight(hl)!==true){remaining.push(hl);}
});
_hlPending=remaining;
if(_hlPending.length>0){
// 還有沒套上的，計時重試
if(_hlTimer)clearTimeout(_hlTimer);
_hlTimer=setTimeout(applyAllHighlights,600);
}
}

// 套用單一 highlight
// 回傳 true  = 成功
// 回傳 false = 頁面還沒有這段文字
function tryApplyHighlight(hl){
var text=hl.text;if(!text)return true;
var savedId=hl.id;if(!savedId)return true;

// 如果 DOM 已經有這個 highlight（刷新後 content script 重跑但 DOM 沒清）
var existing=document.querySelector('[data-hl-id="'+savedId+'"]');
if(existing)return true; // 已存在，視為成功

// TreeWalker 遍歷所有純文字節點，找完全一致的文字
try{
var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null,false);
var node;
while((node=walker.nextNode())){
var v=node.nodeValue||'';
// ★ normalize：把多個空白/whitespace 合併成單一空格，再 trim 比對
var normV=v.replace(/\s+/g,' ').trim();
var normT=text.replace(/\s+/g,' ').trim();
// 完全比對
if(normV===normT){
var span=document.createElement('span');
span.className='pn-hl-'+hl.color;
span.setAttribute('data-pn-hl','true');
span.setAttribute('data-hl-id',savedId);
span.textContent=node.nodeValue; // 保留原始 whitespaces
node.parentNode.replaceChild(span,node);
return true;
}
}
}catch(e){}
return false;
}

// MutationObserver：監聽懶加載 / SPA 路由切換產生的新節點
function startHlObserver(){
if(_hlObserver)return;
_hlObserver=new MutationObserver(function(records){
var hasNewNodes=records.some(function(r){return r.addedNodes.length>0;});
if(!hasNewNodes)return;
// debounce：300ms 內的 DOM 變化只觸發一次重試
if(_hlTimer)clearTimeout(_hlTimer);
_hlTimer=setTimeout(applyAllHighlights,300);
});
_hlObserver.observe(document.body,{childList:true,subtree:true});
}

// ── URL Hash ──────────────────────────────────────────
function checkUrlHash(){
var h=location.hash;
if(!h||h.indexOf('#pn-hl-')!==0)return;
var hlId=h.replace('#pn-hl-','');
function tryScroll(){
var el=document.querySelector('[data-hl-id="'+hlId+'"]');
if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.style.outline='3px solid #6366F1';setTimeout(function(){el.style.outline='';},2000);}
else if(_hlPending.some(function(p){return p.id===hlId||p.hl&&p.hl.id===hlId;})){
setTimeout(tryScroll,500);
}
}
setTimeout(tryScroll,1500);
}

// ── Message Listener ───────────────────────────────────
chrome.runtime.onMessage.addListener(function(req){
if(req.type==='SCROLL_TO_HIGHLIGHT'&&req.hlId){
var el=document.querySelector('[data-hl-id="'+req.hlId+'"]');
if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.style.outline='3px solid #6366F1';setTimeout(function(){el.style.outline='';},2000);}
else{
// 標記還沒套上，註冊到待處理佇列
if(!_hlPending.some(function(p){return p.id===req.hlId;})){
_hlPending.push({id:req.hlId,text:'',color:'yellow'});}
if(_hlTimer)clearTimeout(_hlTimer);
_hlTimer=setTimeout(applyAllHighlights,500);
}
}
if(req.type==='CREATE_NOTE_AT_CENTER')doAddNoteCenter();
});

// ── Load Notes ─────────────────────────────────────────
// ★ popup 呼叫這些 API 時，SW 一定會回應空陣列（决不消失）
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
loadHighlights();
}

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}
else{setTimeout(init,50);}

document.addEventListener('keydown',function(e){if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='n'){e.preventDefault();doAddNoteCenter();}});

// ── Helpers ─────────────────────────────────────────────
function toast(msg){var t=document.querySelector('.pn-toast');if(t)t.remove();t=document.createElement('div');t.className='pn-toast';t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.style.opacity='1';},10);setTimeout(function(){t.style.opacity='0';setTimeout(function(){t.remove();},200);},2000);}
function fmtTime(ts){if(!ts)return'';var d=new Date(ts),diff=Date.now()-d;if(diff<60000)return L('剛剛','Just now');if(diff<3600000)return Math.floor(diff/60000)+L('分','m');if(diff<86400000)return Math.floor(diff/3600000)+L('小時','h');if(diff<604800000)return Math.floor(diff/86400000)+L('天','d');return d.toLocaleDateString(_lang==='en'?'en-US':'zh-TW');}
function escHtml(s){if(!s)return'';return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
})();
