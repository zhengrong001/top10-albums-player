/* =========================================================
   My Top 10 albums of 2026 — Capacitor Android / Web 双模应用
   原生：Filesystem(Documents) + Preferences + NativeAudio
   Web ：localStorage + HTMLAudioElement（便于浏览器预览）
   ========================================================= */

/* ---------- 内置 10 张专辑（原视觉数据，不改） ---------- */
var BUILTIN = [
  {id:'a0',title:'No Bad Memories',artist:'The Avalanches',cover:'',spriteIndex:0,
   tracks:[
    {title:'No Bad Memories',artist:'The Avalanches',cover:'',src:'',duration:210},
    {title:'Subway Train',artist:'The Avalanches',cover:'',src:'',duration:196},
    {title:'Interlude',artist:'The Avalanches',cover:'',src:'',duration:142}]},
  {id:'a1',title:'In the Garden',artist:'Navy Blue',cover:'',spriteIndex:1,
   tracks:[
    {title:'In the Garden',artist:'Navy Blue',cover:'',src:'',duration:224},
    {title:'Blue Room',artist:'Navy Blue',cover:'',src:'',duration:188},
    {title:'Quiet Hours',artist:'Navy Blue',cover:'',src:'',duration:203}]},
  {id:'a2',title:'Trouble Mountain',artist:'Aesop Rock',cover:'',spriteIndex:2,
   tracks:[
    {title:'Trouble Mountain',artist:'Aesop Rock',cover:'',src:'',duration:231},
    {title:'Steep Path',artist:'Aesop Rock',cover:'',src:'',duration:207},
    {title:'Far Side',artist:'Aesop Rock',cover:'',src:'',duration:176}]},
  {id:'a3',title:'Time Heals Everything',artist:'Blu & Exile',cover:'',spriteIndex:3,
   tracks:[
    {title:'Time Heals Everything',artist:'Blu & Exile',cover:'',src:'',duration:218},
    {title:'Thundercat Interlude',artist:'Blu & Exile',cover:'',src:'',duration:152},
    {title:'Slow Light',artist:'Blu & Exile',cover:'',src:'',duration:199}]},
  {id:'a4',title:'Distracted',artist:'Thundercat',cover:'',spriteIndex:4,
   tracks:[
    {title:'Distracted',artist:'Thundercat',cover:'',src:'',duration:195},
    {title:'Night Drive',artist:'Thundercat',cover:'',src:'',duration:211},
    {title:'Blue Note',artist:'Thundercat',cover:'',src:'',duration:184}]},
  {id:'a5',title:'Full Circle',artist:'Tori Mio',cover:'',spriteIndex:5,
   tracks:[
    {title:'Full Circle',artist:'Tori Mio',cover:'',src:'',duration:226},
    {title:'Paper Rings',artist:'Tori Mio',cover:'',src:'',duration:192},
    {title:'Return',artist:'Tori Mio',cover:'',src:'',duration:173}]},
  {id:'a6',title:'Gentlewoman',artist:'Cleo Sol',cover:'',spriteIndex:6,
   tracks:[
    {title:'Gentlewoman',artist:'Cleo Sol',cover:'',src:'',duration:242},
    {title:'Golden Hour',artist:'Cleo Sol',cover:'',src:'',duration:205},
    {title:'Soft Focus',artist:'Cleo Sol',cover:'',src:'',duration:187}]},
  {id:'a7',title:'One Dream, One Star',artist:'Sugar Plant',cover:'',spriteIndex:7,
   tracks:[
    {title:'One Dream, One Star',artist:'Sugar Plant',cover:'',src:'',duration:233},
    {title:'Signal',artist:'Sugar Plant',cover:'',src:'',duration:178},
    {title:'Afterglow',artist:'Sugar Plant',cover:'',src:'',duration:201}]},
  {id:'a8',title:'Trying Times',artist:'James Blake',cover:'',spriteIndex:8,
   tracks:[
    {title:'Trying Times',artist:'James Blake',cover:'',src:'',duration:214},
    {title:'Good Boy',artist:'James Blake',cover:'',src:'',duration:196},
    {title:'Quiet',artist:'James Blake',cover:'',src:'',duration:168}]},
  {id:'a9',title:'Oh Yeah?',artist:'Steve Lacy',cover:'',spriteIndex:9,
   tracks:[
    {title:'Oh Yeah?',artist:'Steve Lacy',cover:'',src:'',duration:208},
    {title:'N Side',artist:'Steve Lacy',cover:'',src:'',duration:190},
    {title:'Pink Moon',artist:'Steve Lacy',cover:'',src:'',duration:176}]}
];

/* ---------- 平台能力检测 ---------- */
var IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
var FS = (typeof capacitorFilesystem !== 'undefined') ? capacitorFilesystem.Filesystem : null;
var Dir = (typeof capacitorFilesystem !== 'undefined') ? capacitorFilesystem.Directory.Documents : null;
var Prefs = (typeof capacitorPreferences !== 'undefined') ? capacitorPreferences.Preferences : null;
var NativeAudio = (typeof capacitorApp !== 'undefined') ? capacitorApp.NativeAudio : null;

var ALBUMS = BUILTIN.slice();
var LIB_KEY = 'top10_user_library_v1';
var uriCache = {};

var stage=document.getElementById('stage');
var casesEl=document.getElementById('cases');
var views=[document.getElementById('viewHome'),document.getElementById('viewAlbum'),document.getElementById('viewPlayer')];
var albumView=views[1],playerView=views[2];
var audioEl=document.getElementById('audio');   // 仅 Web 降级使用
var ghostLayer=document.getElementById('ghostLayer');
var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var scale=1, curAlbum=0, curTrack=0, playing=false, view='home';
var virtualTime=0, virtualDur=0, lastTick=0, dragging=false;
var SPRITE=getComputedStyle(casesEl).backgroundImage;
var audioAssetId='top10track';

/* ---------- 存储：Preferences（原生） / localStorage（Web） ---------- */
async function loadLibrary(){
  try{
    var raw='';
    if(Prefs && IS_NATIVE){ var r=await Prefs.get({key:LIB_KEY}); raw=r.value||''; }
    else { raw=localStorage.getItem(LIB_KEY)||''; }
    if(!raw) return;
    var arr=JSON.parse(raw);
    if(Array.isArray(arr)&&arr.length){
      var seen={}; ALBUMS.forEach(function(a){seen[a.id]=1});
      arr.forEach(function(a){ if(!seen[a.id]) ALBUMS.push(a); });
      rebuildCases();
    }
  }catch(e){ console.warn('loadLibrary',e); }
}
async function saveLibrary(){
  var extra=ALBUMS.filter(function(a){return a.imported});
  try{
    if(Prefs && IS_NATIVE) await Prefs.set({key:LIB_KEY,value:JSON.stringify(extra)});
    else localStorage.setItem(LIB_KEY,JSON.stringify(extra));
  }catch(e){ console.warn('saveLibrary',e); }
}

/* ---------- 文件：Filesystem(Documents) / dataURL ---------- */
function uid(p){ return p+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,8); }
async function saveFile(file,prefix){
  if(FS && IS_NATIVE){
    var name=uid(prefix)+'_'+file.name.replace(/[^\w.\-]/g,'_');
    var b64=await fileToBase64(file);
    await FS.writeFile({path:name,data:b64,directory:Dir,encoding:capacitorFilesystem.FilesystemEncoding.UTF8});
    return name;
  }
  return await fileToDataURL(file);
}
async function fileToBase64(file){
  return new Promise(function(res,rej){
    var r=new FileReader(); r.onload=function(){res(String(r.result).split(',')[1]||'')}; r.onerror=rej; r.readAsDataURL(file);
  });
}
async function fileToDataURL(file){
  return new Promise(function(res,rej){
    var r=new FileReader(); r.onload=function(){res(String(r.result))}; r.onerror=rej; r.readAsDataURL(file);
  });
}
async function resolveSrc(v){
  if(!v) return '';
  if(v.indexOf('data:')===0||v.indexOf('file:')===0||v.indexOf('blob:')===0) return v;
  if(FS && IS_NATIVE){
    if(uriCache[v]) return uriCache[v];
    try{ var u=await FS.getUri({directory:Dir,path:v}); uriCache[v]=u.uri; return u.uri; }
    catch(e){ console.warn('resolveSrc',e); return ''; }
  }
  return v;
}
async function removeFile(v){
  if(!v) return;
  if(FS && IS_NATIVE && v.indexOf('data:')!==0){
    try{ await FS.deleteFile({path:v,directory:Dir}); delete uriCache[v]; }catch(e){}
  }
}

/* ---------- 音频引擎 ---------- */
var AUDIO={
  ready:false, isNative:false, hasTrack:false, duration:0,
  async init(){
    this.isNative=!!(NativeAudio && IS_NATIVE);
    if(this.isNative){
      try{ await NativeAudio.configure({focus:false,fade:false}); }catch(e){}
      try{ await NativeAudio.addListener('complete',function(ev){
        if(ev&&ev.assetId===audioAssetId) switchTrack(1,true);
      }); }catch(e){}
      this.ready=true;
    }
  },
  async load(track){
    await this.unload();
    this.duration=track.duration||0;
    var src=await resolveSrc(track.src);
    if(this.isNative && src){
      try{
        await NativeAudio.preload({assetId:audioAssetId,assetPath:src,isUrl:true,volume:1});
        this.hasTrack=true;
        try{ var d=await NativeAudio.getDuration({assetId:audioAssetId}); if(d&&d.duration>0) this.duration=d.duration; }catch(e){}
      }catch(e){ console.warn('native preload',e); this.hasTrack=false; }
    }else if(src){
      try{
        audioEl.src=src;
        if(!this.duration && isFinite(audioEl.duration)) this.duration=audioEl.duration;
        this.hasTrack=true;
      }catch(e){ this.hasTrack=false; }
    }else{
      // 内置占位曲目：无真实音频，用虚拟时钟驱动进度（浏览器/设备均可验收交互）
      audioEl.removeAttribute('src'); this.hasTrack=false;
    }
    updateProgress();
  },
  async unload(){
    if(this.isNative && this.hasTrack){
      try{ await NativeAudio.stop({assetId:audioAssetId}); }catch(e){}
      try{ await NativeAudio.unload({assetId:audioAssetId}); }catch(e){}
    }
    if(!this.isNative){ try{ audioEl.pause(); audioEl.removeAttribute('src'); }catch(e){} }
    this.hasTrack=false;
  },
  async play(time){
    if(this.isNative && this.hasTrack){
      try{ await NativeAudio.play({assetId:audioAssetId,time:Math.max(0,time||0)}); return true; }
      catch(e){ console.warn('native play',e); return false; }
    }
    if(this.hasTrack && audioEl.src){
      try{ if(time>0) audioEl.currentTime=time; await audioEl.play(); return true; }catch(e){ return false; }
    }
    return true; // 虚拟时钟模式
  },
  async pause(){
    if(this.isNative && this.hasTrack){ try{ await NativeAudio.pause({assetId:audioAssetId}); }catch(e){} }
    else if(this.hasTrack){ try{ audioEl.pause(); }catch(e){} }
  },
  async seek(t){
    var was=playing;
    if(this.isNative && this.hasTrack){
      try{ await NativeAudio.play({assetId:audioAssetId,time:Math.max(0,t)}); if(!was) await NativeAudio.pause({assetId:audioAssetId}); }catch(e){}
    }else if(this.hasTrack && audioEl.src){ try{ audioEl.currentTime=t; }catch(e){} }
    else { virtualTime=Math.max(0,Math.min(virtualDur,t)); }
    updateProgress();
  },
  async time(){
    if(this.isNative && this.hasTrack){ try{ var r=await NativeAudio.getCurrentTime({assetId:audioAssetId}); return r.currentTime||0; }catch(e){return 0;} }
    if(this.hasTrack && audioEl.src) return audioEl.currentTime||0;
    return virtualTime;
  },
  async duration(){
    if(this.duration>0) return this.duration;
    if(this.isNative && this.hasTrack){ try{ var r=await NativeAudio.getDuration({assetId:audioAssetId}); return r.duration||0; }catch(e){return 0;} }
    if(this.hasTrack && audioEl.src && isFinite(audioEl.duration)) return audioEl.duration;
    return virtualDur;
  }
};
audioEl.addEventListener('ended',function(){ if(!AUDIO.isNative) switchTrack(1,true); });
audioEl.addEventListener('timeupdate',function(){ if(!dragging && !AUDIO.isNative) updateProgress(); });

/* ---------- 通用 UI 逻辑（保留原交互） ---------- */
function fit(){ scale=Math.min(window.innerWidth/720,window.innerHeight/1280,1); stage.style.transform='scale('+scale+')'; }
window.addEventListener('resize',fit); fit();

function albumOf(i){return ALBUMS[i]}
function coverCss(albumIdx,trackCover){
  var al=albumOf(albumIdx);
  var c=trackCover||al.cover;
  if(c) return 'url("'+c+'") center/cover no-repeat';
  if(al.spriteIndex<0) return '#d8d8d0';
  var px=(al.spriteIndex/9*100).toFixed(4);
  return SPRITE+' '+px+'% 50%/1000% auto no-repeat, '+SPRITE+' 0 0/480px 586px no-repeat';
}
function fmt(t){ if(!isFinite(t)||t<0)t=0; var m=Math.floor(t/60),s=Math.floor(t%60); return m+':'+(s<10?'0':'')+s; }

function rebuildCases(){
  Array.prototype.slice.call(casesEl.querySelectorAll('.case')).forEach(function(n){n.remove()});
  ALBUMS.forEach(function(al,i){
    var c=document.createElement('div');
    c.className='case'; c.setAttribute('data-album-index',String(i));
    c.style.left=(al.spriteIndex<0?((i%10)*48):(al.spriteIndex*48))+'px';
    if(al.cover){
      var img=document.createElement('div'); img.className='case-cover';
      img.style.background='url("'+al.cover+'") center/cover no-repeat'; c.appendChild(img);
    }
    c.addEventListener('click',function(){openAlbum(i,c)});
    casesEl.appendChild(c);
  });
}
rebuildCases();

function setCover(el,bg){
  var a=el.querySelector('.cover-a'),b=el.querySelector('.cover-b');
  if(a.getAttribute('data-on')==='1'){ b.style.background=bg;b.setAttribute('data-on','1');a.setAttribute('data-on','0'); }
  else{ a.style.background=bg;a.setAttribute('data-on','1');b.setAttribute('data-on','0'); }
}
function showView(name){
  view=name;
  var id='view'+name.charAt(0).toUpperCase()+name.slice(1);
  views.forEach(function(v){v.classList.toggle('is-active',v.id===id);});
  views.forEach(function(v){v.setAttribute('aria-hidden',v.classList.contains('is-active')?'false':'true');});
}
function maybeVT(fn){
  try{ if(document.startViewTransition){return document.startViewTransition(fn).finished.catch(function(){});} }catch(e){}
  fn();return Promise.resolve();
}
function rectOf(el){var r=el.getBoundingClientRect();var sr=stage.getBoundingClientRect();
  return {left:(r.left-sr.left)/scale,top:(r.top-sr.top)/scale,width:r.width/scale,height:r.height/scale};}
function flyGhost(from,to,bg,done){
  if(reduce||!from||!to){done&&done();return Promise.resolve();}
  var g=document.createElement('div');g.className='ghost';
  g.style.left=from.left+'px';g.style.top=from.top+'px';
  g.style.width=from.width+'px';g.style.height=from.height+'px';g.style.background=bg;
  ghostLayer.appendChild(g);
  var dx=to.left-from.left,dy=to.top-from.top,sx=to.width/from.width,sy=to.height/from.height;
  var a=g.animate([{transform:'translate(0,0) scale(1,1)',opacity:1},
    {transform:'translate('+dx+'px,'+dy+'px) scale('+sx+','+sy+')',opacity:1}],
    {duration:420,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
  return a.finished.then(function(){g.remove();done&&done();}).catch(function(){g.remove();done&&done();});
}

function openAlbum(i,caseEl){
  curAlbum=i; renderAlbum(i);
  var from=rectOf(caseEl);
  maybeVT(function(){showView('album')});
  requestAnimationFrame(function(){ flyGhost(from,rectOf(document.getElementById('albumCover')),coverCss(i,albumOf(i).cover)); });
}
function renderAlbum(i){
  var al=albumOf(i);
  setCover(document.getElementById('albumCover'),coverCss(i,al.cover));
  document.getElementById('albumTitle').textContent=al.title;
  document.getElementById('albumArtist').textContent=al.artist;
  var list=document.getElementById('trackList');list.innerHTML='';
  al.tracks.forEach(function(t,k){
    var row=document.createElement('div');row.className='track';row.setAttribute('data-track-index',String(k));
    var cv=document.createElement('div');cv.className='track-cover';cv.style.background=coverCss(i,t.cover);
    var cap=document.createElement('div');cap.className='track-cap';
    var s=document.createElement('strong');s.textContent=t.title;
    var sp=document.createElement('span');sp.textContent=t.artist;
    cap.appendChild(s);cap.appendChild(sp);cv.appendChild(cap);
    var no=document.createElement('div');no.className='track-no';no.textContent=('0'+(k+1)).slice(-2);
    row.appendChild(cv);row.appendChild(no);
    row.addEventListener('click',function(e){
      if(e.target.classList.contains('track-del'))return;
      openPlayer(k,cv);
    });
    if(al.imported){
      var del=document.createElement('button');del.className='track-del';del.textContent='×';
      del.title='删除这首歌';
      del.addEventListener('click',function(e){e.stopPropagation();confirmPanel('删除歌曲“'+t.title+'”？',function(){deleteTrack(i,k)});});
      row.appendChild(del);
    }
    list.appendChild(row);
  });
}

function openPlayer(k,coverEl){
  curTrack=k; renderTrack(k);
  var from=rectOf(coverEl);
  maybeVT(function(){showView('player')});
  requestAnimationFrame(function(){ flyGhost(from,rectOf(document.getElementById('vinylLabel')),coverCss(curAlbum,albumOf(curAlbum).tracks[k].cover)); });
}
async function renderTrack(k){
  var t=albumOf(curAlbum).tracks[k];
  setCover(document.getElementById('vinylLabel'),coverCss(curAlbum,t.cover));
  document.getElementById('nowTitle').textContent=t.title;
  document.getElementById('nowArtist').textContent=t.artist;
  document.getElementById('playHint').textContent='';
  virtualTime=0;virtualDur=t.duration||210;
  await AUDIO.load(t);
  setPlaying(false);
  updateProgress();
}
function setPlaying(v){
  playing=v;
  document.getElementById('vinyl').classList.toggle('playing',v);
  document.getElementById('btnPlay').textContent=v?'❚❚':'▶';
  document.getElementById('btnPlay').setAttribute('aria-label',v?'Pause':'Play');
  document.getElementById('playHint').textContent=v?'':(AUDIO.hasTrack?'点按 ▶ 播放（不会自动播放）':'内置示例曲目 · 导入音频后可播放');
}
async function togglePlay(){
  if(playing){ await AUDIO.pause(); setPlaying(false); }
  else{
    var ok=await AUDIO.play(virtualTime);
    if(ok) setPlaying(true);
    else{ setPlaying(false); document.getElementById('playHint').textContent='播放失败，请检查音频文件'; }
  }
}
function paintProgress(c,d){
  var p=d>0?Math.max(0,Math.min(1,c/d)):0;
  document.getElementById('progressFill').style.width=(p*100)+'%';
  document.getElementById('progressKnob').style.left=(p*100)+'%';
  document.getElementById('timeCur').textContent=fmt(c);
  document.getElementById('timeDur').textContent=fmt(d||virtualDur);
}
async function updateProgress(){
  var d=await AUDIO.duration(), c=await AUDIO.time();
  paintProgress(c,d);
}
async function switchTrack(step,autoEnded){
  var list=albumOf(curAlbum).tracks;
  var next=curTrack+step;
  if(next>=list.length){
    if(autoEnded){ await AUDIO.pause(); setPlaying(false); await AUDIO.seek(0); virtualTime=0; updateProgress(); return; }
    next=0;
  }
  if(next<0)next=list.length-1;
  curTrack=next; await renderTrack(next);
  if(playing){ var ok=await AUDIO.play(0); if(ok) setPlaying(true); }
}
function seekFromEvent(e){
  var el=document.getElementById('progress'),r=el.getBoundingClientRect();
  var p=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
  AUDIO.duration().then(function(d){ AUDIO.seek(p*(d||virtualDur)); });
}
document.getElementById('progress').addEventListener('pointerdown',function(e){dragging=true;this.setPointerCapture(e.pointerId);seekFromEvent(e);});
document.getElementById('progress').addEventListener('pointermove',function(e){if(dragging)seekFromEvent(e)});
document.getElementById('progress').addEventListener('pointerup',function(e){dragging=false;try{this.releasePointerCapture(e.pointerId)}catch(err){}});
document.getElementById('progress').addEventListener('pointercancel',function(){dragging=false});

document.getElementById('btnPlay').addEventListener('click',togglePlay);
document.getElementById('btnPrev').addEventListener('click',function(){switchTrack(-1,false)});
document.getElementById('btnNext').addEventListener('click',function(){switchTrack(1,false)});
function goBack(){
  if(view==='player'){ AUDIO.pause(); setPlaying(false); maybeVT(function(){showView('album')}); }
  else if(view==='album'){ AUDIO.pause(); setPlaying(false); maybeVT(function(){showView('home')}); }
  else closePanel();
}
document.getElementById('backPlayer').addEventListener('click',goBack);
document.getElementById('backAlbum').addEventListener('click',goBack);
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){ e.preventDefault(); if(panelOpen) closePanel(); else goBack(); return; }
  if(panelOpen||view!=='player')return;
  if(e.code==='Space'){e.preventDefault();togglePlay()}
  else if(e.key==='ArrowLeft'){e.preventDefault();switchTrack(-1,false)}
  else if(e.key==='ArrowRight'){e.preventDefault();switchTrack(1,false)}
});
function tick(ts){
  if(playing&&!AUDIO.hasTrack){
    if(!lastTick)lastTick=ts;
    var dt=(ts-lastTick)/1000;lastTick=ts;
    virtualTime+=dt;
    if(virtualTime>=virtualDur){switchTrack(1,true)} else paintProgress(virtualTime,virtualDur);
  }else lastTick=ts;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* =========================================================
   导入 / 删除 UI（米白纸感，原生与 Web 通用）
   ========================================================= */
var panelOpen=false, panelAction=null, pendingCover=null, pendingFiles=null;

var importBtn=document.createElement('button');
importBtn.className='import-fab'; importBtn.textContent='＋';
importBtn.title='导入自己的音乐';
importBtn.addEventListener('click',function(){openPanel('import')});
document.getElementById('viewHome').appendChild(importBtn);

var addSongsBtn=document.getElementById('addSongsBtn');
if(addSongsBtn) addSongsBtn.addEventListener('click',function(){openPanel('addSongs')});
var delAlbumBtn=document.getElementById('delAlbumBtn');
if(delAlbumBtn) delAlbumBtn.addEventListener('click',function(){
  confirmPanel('删除专辑“'+albumOf(curAlbum).title+'”及其全部文件？',function(){deleteAlbum(curAlbum)});
});

var panel=document.createElement('div');panel.className='sheet';panel.id='sheet';
panel.innerHTML=
 '<div class="sheet-card">'+
  '<h2 id="sheetTitle">Import</h2>'+
  '<div id="sheetBody"></div>'+
  '<div class="sheet-actions"><button class="sheet-btn ghost" id="sheetCancel">Cancel</button>'+
  '<button class="sheet-btn" id="sheetOk">OK</button></div>'+
 '</div>';
document.getElementById('viewHome').parentNode.appendChild(panel);
document.getElementById('sheetCancel').addEventListener('click',closePanel);
document.getElementById('sheetOk').addEventListener('click',function(){ if(panelAction) panelAction(); });
panel.addEventListener('click',function(e){ if(e.target===panel) closePanel(); });

function openPanel(kind){
  panelOpen=true;panel.classList.add('open');
  pendingCover=null;pendingFiles=null;
  var title=document.getElementById('sheetTitle'),body=document.getElementById('sheetBody'),ok=document.getElementById('sheetOk');
  if(kind==='import'){
    title.textContent='导入专辑';
    ok.textContent='导入';
    body.innerHTML=
      '<label class="fld">专辑名<input id="fAlbum" placeholder="Album name"></label>'+
      '<label class="fld">歌手<input id="fArtist" placeholder="Artist"></label>'+
      '<label class="fld">专辑封面（图片）<input type="file" id="fCover" accept="image/*"></label>'+
      '<label class="fld">音频文件（mp3 / m4a，可多选）<input type="file" id="fAudio" accept="audio/mpeg,audio/mp4,.mp3,.m4a" multiple></label>'+
      '<p class="tip" id="fTip">文件会复制到 App 的 Documents 目录并持久保存</p>';
    document.getElementById('fCover').addEventListener('change',function(e){pendingCover=e.target.files[0]||null;});
    document.getElementById('fAudio').addEventListener('change',function(e){pendingFiles=Array.prototype.slice.call(e.target.files||[]);tipFiles();});
    function tipFiles(){ document.getElementById('fTip').textContent=(pendingFiles&&pendingFiles.length)?('已选择 '+pendingFiles.length+' 首音频'):'文件会复制到 App 的 Documents 目录并持久保存'; }
    panelAction=doImport;
  }else if(kind==='addSongs'){
    title.textContent='添加歌曲到「'+albumOf(curAlbum).title+'」';
    ok.textContent='添加';
    body.innerHTML=
      '<label class="fld">音频文件（mp3 / m4a，可多选）<input type="file" id="fAudio2" accept="audio/mpeg,audio/mp4,.mp3,.m4a" multiple></label>'+
      '<label class="fld">歌曲封面（可选，图片）<input type="file" id="fCover2" accept="image/*"></label>'+
      '<p class="tip" id="fTip2">未选封面时，歌曲沿用专辑封面</p>';
    document.getElementById('fAudio2').addEventListener('change',function(e){pendingFiles=Array.prototype.slice.call(e.target.files||[]);document.getElementById('fTip2').textContent=(pendingFiles&&pendingFiles.length)?('已选择 '+pendingFiles.length+' 首音频'):'未选封面时，歌曲沿用专辑封面';});
    document.getElementById('fCover2').addEventListener('change',function(e){pendingCover=e.target.files[0]||null;});
    panelAction=doAddSongs;
  }
}
function closePanel(){ panelOpen=false;panel.classList.remove('open');panelAction=null; }

function confirmPanel(msg,onOK){
  panelOpen=true;panel.classList.add('open');
  document.getElementById('sheetTitle').textContent='确认删除';
  document.getElementById('sheetBody').innerHTML='<p class="confirm">'+msg+'</p>';
  var ok=document.getElementById('sheetOk');ok.textContent='删除';
  panelAction=function(){ closePanel(); onOK(); };
}

async function doImport(){
  var name=(document.getElementById('fAlbum').value||'').trim()||'My Album';
  var artist=(document.getElementById('fArtist').value||'').trim()||'Unknown Artist';
  if(!pendingFiles||!pendingFiles.length){ document.getElementById('fTip').textContent='请先选择至少一个音频文件'; return; }
  closePanel();
  var coverName=pendingCover?await saveFile(pendingCover,'cover'):'';
  var tracks=[];
  for(var i=0;i<pendingFiles.length;i++){
    var f=pendingFiles[i];
    var src=await saveFile(f,'audio');
    tracks.push({title:f.name.replace(/\.[^.]+$/,''),artist:artist,cover:'',src:src,duration:0});
  }
  ALBUMS.push({id:uid('u'),title:name,artist:artist,cover:coverName,spriteIndex:-1,imported:true,tracks:tracks});
  await saveLibrary();rebuildCases();
  if(coverName){ var c=casesEl.lastChild; }
}

async function doAddSongs(){
  if(!pendingFiles||!pendingFiles.length){ document.getElementById('fTip2').textContent='请先选择音频文件'; return; }
  var idx=curAlbum;closePanel();
  var coverName=pendingCover?await saveFile(pendingCover,'cover'):'';
  for(var i=0;i<pendingFiles.length;i++){
    var f=pendingFiles[i];
    ALBUMS[idx].tracks.push({title:f.name.replace(/\.[^.]+$/,''),artist:albumOf(idx).artist,cover:coverName,src:await saveFile(f,'audio'),duration:0});
  }
  await saveLibrary();renderAlbum(idx);
}

async function deleteTrack(ai,ti){
  var al=ALBUMS[ai],t=al.tracks[ti];
  if(t.cover&&al.tracks.filter(function(x){return x.cover===t.cover}).length===1) await removeFile(t.cover);
  await removeFile(t.src);
  al.tracks.splice(ti,1);
  await saveLibrary();renderAlbum(ai);
}
async function deleteAlbum(ai){
  var al=ALBUMS[ai];
  if(al.cover) await removeFile(al.cover);
  for(var i=0;i<al.tracks.length;i++){
    var t=al.tracks[i];
    if(t.cover) await removeFile(t.cover);
    await removeFile(t.src);
  }
  ALBUMS.splice(ai,1);
  await saveLibrary();rebuildCases();showView('home');
}

/* ---------- 启动 ---------- */
(async function(){
  await AUDIO.init();
  await loadLibrary();
  rebuildCases();
})();
