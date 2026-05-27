(function(){
  'use strict';

  function loadMemberAuth(){
    return new Promise(function(resolve,reject){
      if(window.HaberMember){resolve();return;}
      var current=document.querySelector('script[data-member-auth-loader]');
      if(current){
        current.addEventListener('load',resolve,{once:true});
        current.addEventListener('error',reject,{once:true});
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

  function cleanArticleUrl(){
    return window.location.origin+window.location.pathname;
  }

  function articleData(){
    var titleNode=document.querySelector('article h1');
    var parts=window.location.pathname.split('/').filter(Boolean);
    return {
      url:cleanArticleUrl(),
      title:titleNode?titleNode.textContent.trim():document.title.replace(/\s*\|.*$/,''),
      slug:parts.length?parts[parts.length-1]:''
    };
  }

  function nextLoginUrl(){
    return '/login.html?next='+encodeURIComponent(window.location.pathname+window.location.search+window.location.hash);
  }

  function setMessage(text,isError){
    var status=document.getElementById('member-article-message');
    if(!status)return;
    status.textContent=text||'';
    status.classList.toggle('error',Boolean(isError));
  }

  function setButton(saved){
    var button=document.getElementById('member-save-article');
    if(!button)return;
    button.dataset.saved=saved?'true':'false';
    button.classList.toggle('is-saved',saved);
    button.textContent=saved?'✓ Kaydedildi · Kaldır':'♡ Haberi Kaydet';
    button.setAttribute('aria-pressed',saved?'true':'false');
  }

  document.addEventListener('DOMContentLoaded',async function(){
    var button=document.getElementById('member-save-article');
    if(!button)return;
    var activeSession=null;
    try{
      await loadMemberAuth();
      activeSession=await window.HaberMember.session();
      if(activeSession&&activeSession.user){
        var found=await window.HaberMember.isArticleSaved(cleanArticleUrl());
        if(!found.error)setButton(Boolean(found.data));
      }
    }catch(error){
      setMessage('Kaydetme durumu yüklenemedi.',true);
    }

    button.addEventListener('click',async function(){
      button.disabled=true;
      try{
        activeSession=await window.HaberMember.session();
        if(!activeSession||!activeSession.user){
          location.href=nextLoginUrl();
          return;
        }
        var alreadySaved=button.dataset.saved==='true';
        var response=alreadySaved
          ? await window.HaberMember.removeArticle(cleanArticleUrl())
          : await window.HaberMember.saveArticle(articleData());
        if(response.error)throw response.error;
        setButton(!alreadySaved);
        setMessage(alreadySaved?'Haber kayıtlarınızdan kaldırıldı.':'Haber hesabınıza kaydedildi.',false);
      }catch(error){
        setMessage('İşlem tamamlanamadı. Lütfen yeniden deneyin.',true);
      }finally{
        button.disabled=false;
      }
    });
  });
})();
