(function(){
  'use strict';

  /* ── Dil algılama ── */
  function detectLang(){
    var link=document.querySelector('.member-login-btn');
    if(link){
      var m=String(link.href||link.getAttribute('href')||'').match(/[?&]lang=([a-z]{2})/);
      if(m)return m[1];
    }
    var p=location.pathname;
    if(p.startsWith('/nachrichten')||p.startsWith('/berlin')||p.includes('/de'))return 'de';
    if(p.startsWith('/news')||p.startsWith('/new-york')||p.includes('/en'))return 'en';
    return 'tr';
  }

  var I18N={
    tr:{myAccount:'Hesabım',saved:'Kaydettiklerim',interests:'İlgi Alanlarım',notifications:'Bildirim Tercihlerim',logout:'Çıkış Yap',fallback:'Hesabım',logoutPath:'/'},
    en:{myAccount:'My Account',saved:'Saved Articles',interests:'My Interests',notifications:'Notification Settings',logout:'Sign Out',fallback:'Account',logoutPath:'/news/'},
    de:{myAccount:'Mein Konto',saved:'Gespeicherte Artikel',interests:'Meine Interessen',notifications:'Benachrichtigungen',logout:'Abmelden',fallback:'Konto',logoutPath:'/nachrichten/'}
  };

  function t(key){
    var lang=detectLang();
    var dict=I18N[lang]||I18N.tr;
    return dict[key]||I18N.tr[key]||key;
  }

  function accountPath(){
    var lang=detectLang();
    if(lang==='en')return'/account.html?lang=en';
    if(lang==='de')return'/account.html?lang=de';
    return'/account.html';
  }

  function loadMemberAuth(){
    return new Promise(function(resolve,reject){
      if(window.HaberMember){resolve();return;}
      var existing=document.querySelector('script[data-member-auth-loader]');
      if(existing){
        existing.addEventListener('load',resolve,{once:true});
        existing.addEventListener('error',reject,{once:true});
        return;
      }
      var script=document.createElement('script');
      script.src='/assets/js/member-auth.js';
      script.defer=true;
      script.dataset.memberAuthLoader='true';
      script.onload=resolve;
      script.onerror=reject;
      document.head.appendChild(script);
    });
  }

  function memberName(user){
    var meta=user&&user.user_metadata?user.user_metadata:{};
    var value=String(meta.display_name||meta.full_name||meta.name||'').trim();
    if(value)return value.split(/\s+/)[0];
    var email=String(user&&user.email||'');
    return email?email.split('@')[0]:t('fallback');
  }

  function firstLetter(name){
    return String(name||'H').trim().charAt(0).toLocaleUpperCase('tr-TR')||'H';
  }

  function styles(){
    if(document.getElementById('member-menu-styles'))return;
    var style=document.createElement('style');
    style.id='member-menu-styles';
    style.textContent='.member-nav-shell{position:relative;display:inline-flex;min-width:0}.member-login-btn.is-member{display:inline-flex;align-items:center;gap:8px;min-height:44px;max-width:178px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-radius:11px!important;padding:9px 13px!important;background:linear-gradient(135deg,#e10600,#c40000)!important;box-shadow:0 10px 24px rgba(225,6,0,.18)!important}.member-login-btn .member-avatar{width:24px;height:24px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:rgba(255,255,255,.18);color:#fff;font-size:.74rem;font-weight:900;flex:0 0 24px}.member-login-btn .member-name{min-width:0;overflow:hidden;text-overflow:ellipsis}.member-login-btn .member-caret{font-size:.72rem;opacity:.9}.member-account-menu{position:absolute;top:calc(100% + 9px);right:0;z-index:400;min-width:230px;padding:8px;background:#fff;border:1px solid #e1e5ea;border-radius:12px;box-shadow:0 16px 34px rgba(15,23,42,.16);display:none}.member-account-menu.is-open{display:grid;gap:3px}.member-account-menu a,.member-account-menu button{appearance:none;display:block;width:100%;border:0;background:transparent;padding:11px;border-radius:8px;text-align:left;text-decoration:none;color:#24292f;font:inherit;font-size:.88rem;font-weight:800;cursor:pointer}.member-account-menu a:hover,.member-account-menu button:hover{background:#f4f6f8;color:#e10600}.member-account-menu .member-logout{margin-top:5px;padding-top:11px;border-top:1px solid #e1e5ea;color:#b42318}@media(max-width:640px){.member-nav-shell{max-width:132px}.member-login-btn.is-member{max-width:132px;min-height:40px;padding-left:9px!important;padding-right:9px!important}.member-login-btn .member-avatar{width:22px;height:22px;flex-basis:22px}.member-account-menu{right:0;min-width:min(245px,86vw)}}';
    document.head.appendChild(style);
  }

  function renderMemberButton(link,name){
    link.textContent='';
    var avatar=document.createElement('span');
    avatar.className='member-avatar';
    avatar.textContent=firstLetter(name);
    var label=document.createElement('span');
    label.className='member-name';
    label.textContent=name;
    var caret=document.createElement('span');
    caret.className='member-caret';
    caret.setAttribute('aria-hidden','true');
    caret.textContent='▾';
    link.appendChild(avatar);
    link.appendChild(label);
    link.appendChild(caret);
  }

  function buildMenu(){
    var acc=accountPath();
    return '<a href="'+acc+'" role="menuitem">'+t('myAccount')+'</a>'
      +'<a href="'+acc+'#saved" role="menuitem">'+t('saved')+'</a>'
      +'<a href="'+acc+'#interests" role="menuitem">'+t('interests')+'</a>'
      +'<a href="'+acc+'#notifications" role="menuitem">'+t('notifications')+'</a>'
      +'<button class="member-logout" type="button" role="menuitem">'+t('logout')+'</button>';
  }

  async function init(){
    var link=document.querySelector('.member-login-btn');
    if(!link)return;
    try{
      await loadMemberAuth();
      var active=await window.HaberMember.session();
      if(!active||!active.user)return;
      styles();
      var shell=document.createElement('span');
      shell.className='member-nav-shell';
      link.parentNode.insertBefore(shell,link);
      shell.appendChild(link);
      var name=memberName(active.user);
      link.classList.add('is-member');
      link.href=accountPath();
      renderMemberButton(link,name);
      link.setAttribute('aria-haspopup','menu');
      link.setAttribute('aria-expanded','false');
      var menu=document.createElement('div');
      menu.className='member-account-menu';
      menu.setAttribute('role','menu');
      menu.innerHTML=buildMenu();
      shell.appendChild(menu);
      link.addEventListener('click',function(event){
        event.preventDefault();
        var open=menu.classList.toggle('is-open');
        link.setAttribute('aria-expanded',open?'true':'false');
      });
      menu.querySelector('.member-logout').addEventListener('click',async function(){
        await window.HaberMember.logout();
        var lang=detectLang();
        var dict=I18N[lang]||I18N.tr;
        location.href=dict.logoutPath;
      });
      document.addEventListener('click',function(event){
        if(shell.contains(event.target))return;
        menu.classList.remove('is-open');
        link.setAttribute('aria-expanded','false');
      });
    }catch(error){
      console.warn('Member session could not be loaded.');
    }
  }

  init();
})();
