(function(){
  'use strict';
  var cache=null,timer=null,saved=null,sections=null;
  function ready(fn){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();}
  function norm(v){return String(v||'').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ı/g,'i').replace(/ö/g,'o').replace(/ş/g,'s').replace(/ü/g,'u').replace(/\s+/g,' ').trim();}
  function load(){if(cache)return Promise.resolve(cache);return fetch('/data/articles.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():{articles:[]};}).then(function(d){cache=Array.isArray(d)?d:(d.articles||d.items||[]);return cache;}).catch(function(){return fetch('/data/search-index.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():{items:[]};}).then(function(d){cache=Array.isArray(d)?d:(d.items||d.articles||[]);return cache;}).catch(function(){return[];});});}
  function empty(n){while(n.firstChild)n.removeChild(n.firstChild);}
  function text(n,tag,cls,val){var e=document.createElement(tag);if(cls)e.className=cls;e.textContent=val||'';n.appendChild(e);return e;}
  function save(grid){if(!saved)saved=[].slice.call(grid.children);if(!sections)sections=[].slice.call(document.querySelectorAll('[data-news-section]')).map(function(s){return{s:s,h:s.hidden};});}
  function restore(grid,status){document.body.dataset.searchActive='false';empty(grid);(saved||[]).forEach(function(n){grid.appendChild(n);});(sections||[]).forEach(function(x){x.s.hidden=x.h;});if(status)status.textContent='';if(window.countCards)window.countCards();if(window.refreshSideHeadlineRotation)window.refreshSideHeadlineRotation();}
  function matches(item,words){var hay=norm([item.title,item.summary,item.category,item.category_slug,item.date,item.date_iso,item.source_name,Array.isArray(item.tags)?item.tags.join(' '):''].join(' '));return words.every(function(w){return hay.indexOf(w)>-1;});}
  function country(c){return c==='USA'?'US Amerika':c==='Germany'?'DE Almanya':'TR Türkiye';}
  function card(item){var title=item.title||'Haber',href=item.url||item.canonical_url||'#',img=item.image_url||(item.image&&item.image.url)||'',topic=item.category_slug||norm(item.category||'gundem').replace(/\s+/g,'-'),a,b,m,h,l,f,r,w,im;
    a=document.createElement('article');a.className='news-card topic-card is-global-search-card';a.dataset.topic=topic;a.dataset.globalSearch='true';
    if(img){l=document.createElement('a');l.className='card-image-link';l.href=href;l.setAttribute('aria-label',title);w=document.createElement('div');w.className='card-image';im=document.createElement('img');im.src=img;im.alt=item.image_alt||(item.image&&item.image.alt)||title;im.loading='lazy';im.width=1080;im.height=720;w.appendChild(im);l.appendChild(w);a.appendChild(l);}
    b=document.createElement('div');b.className='card-body';m=document.createElement('div');m.className='card-meta';text(m,'span','card-category',country(item.country));text(m,'span','card-topic',item.category||'Gündem');text(m,'time','card-date',item.date||item.date_iso||'');b.appendChild(m);
    h=document.createElement('h3');h.className='card-title';l=document.createElement('a');l.href=href;l.textContent=title;h.appendChild(l);b.appendChild(h);if(item.summary)text(b,'p','card-excerpt',item.summary);
    f=document.createElement('div');f.className='card-footer';r=text(f,'a','read-more','Devamını Oku →');r.href=href;b.appendChild(f);a.appendChild(b);return a;}
  function render(grid,status,items){var owner=grid.closest('[data-news-section]');empty(grid);items.slice(0,120).forEach(function(i){grid.appendChild(card(i));});document.body.dataset.searchActive='true';document.querySelectorAll('[data-news-section]').forEach(function(s){s.hidden=owner?s!==owner:false;});if(status)status.textContent=items.length?items.length+' sonuç bulundu.':'Aramanıza uygun haber bulunamadı.';if(window.countCards)window.countCards();if(window.refreshSideHeadlineRotation)window.refreshSideHeadlineRotation();}
  function install(){var input=document.getElementById('news-search-input'),clear=document.getElementById('news-search-clear'),grid=document.getElementById('grid-turkey')||document.querySelector('.news-grid'),status=document.getElementById('news-search-status');if(!input||!grid)return;
    function run(){var q=norm(input.value),words=q.split(' ').filter(Boolean);if(clear)clear.hidden=!words.length;if(!words.length)return restore(grid,status);save(grid);load().then(function(items){render(grid,status,items.filter(function(i){return matches(i,words);}));});}
    input.addEventListener('input',function(e){e.stopImmediatePropagation();clearTimeout(timer);timer=setTimeout(run,120);},true);
    if(clear)clear.addEventListener('click',function(e){e.preventDefault();e.stopImmediatePropagation();input.value='';clear.hidden=true;restore(grid,status);input.focus();},true);
  }
  ready(install);
})();
