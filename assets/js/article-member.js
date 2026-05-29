(function(){
  'use strict';

  function loadMemberAuth(){
    return new Promise(function(resolve,reject){
      if(window.HaberMember){resolve();return;}
      var script=document.createElement('script');
      script.src='/assets/js/member-auth.js?v=20260530b';
      script.defer=true;
      script.onload=resolve;
      script.onerror=reject;
      document.head.appendChild(script);
    });
  }

  function cleanArticleUrl(){return window.location.origin+window.location.pathname;}

  function articleData(){
    var titleNode=document.querySelector('article h1');
    var parts=window.location.pathname.split('/').filter(Boolean);
    return {
      url:cleanArticleUrl(),
      title:titleNode?titleNode.textContent.trim():document.title.replace(/\s*\|.*$/,''),
      slug:parts.length?parts[parts.length-1].replace(/\.html$/,''):''
    };
  }

  function nextLoginUrl(){return '/login.html?next='+encodeURIComponent(window.location.pathname+window.location.search+window.location.hash);}

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

  function secureLegacyComments(activeSession){
    var section=document.querySelector('.article-comments');
    if(!section)return;
    var form=section.querySelector('#comment-form');
    var name=section.querySelector('#comment-name');
    var list=section.querySelector('#comment-list');
    var notice=document.createElement('p');
    notice.id='comment-auth-message';
    notice.className='member-article-message';
    if(form&&form.parentNode)form.parentNode.insertBefore(notice,form);
    if(name)name.remove();
    if(activeSession&&activeSession.user){
      notice.textContent='Yorum yazma yalnız üyelere açıktır. Oturumunuz açık.';
      if(form)form.style.display='grid';
    }else{
      notice.innerHTML='Yorumları herkes okuyabilir; yorum yazmak için <a href="'+nextLoginUrl()+'">üye girişi yapın</a>.';
      if(form)form.style.display='none';
    }
    if(list)list.innerHTML='';
  }

  document.addEventListener('DOMContentLoaded',async function(){
    var button=document.getElementById('member-save-article');
    var activeSession=null;
    try{
      await loadMemberAuth();
      activeSession=await window.HaberMember.session();
      secureLegacyComments(activeSession);
      if(button&&activeSession&&activeSession.user){
        var found=await window.HaberMember.isArticleSaved(cleanArticleUrl());
        if(!found.error)setButton(Boolean(found.data));
      }
    }catch(error){
      secureLegacyComments(null);
      setMessage('Üyelik durumu yüklenemedi.',true);
    }

    var commentForm=document.getElementById('comment-form');
    if(commentForm){
      commentForm.addEventListener('submit',async function(event){
        event.preventDefault();
        try{
          activeSession=await window.HaberMember.session();
          if(!activeSession||!activeSession.user){location.href=nextLoginUrl();return;}
          var textarea=document.getElementById('comment-text');
          var body=textarea?textarea.value.trim():'';
          if(!body)return;
          var response=await window.HaberMember.createComment(articleData(),body);
          if(response.error)throw response.error;
          if(textarea)textarea.value='';
          var notice=document.getElementById('comment-auth-message');
          if(notice)notice.textContent='Yorumunuz yayınlandı.';
        }catch(error){
          var msg=document.getElementById('comment-auth-message');
          if(msg)msg.textContent='Yorum gönderilemedi. Lütfen yeniden deneyin.';
        }
      },true);
    }

    if(!button)return;
    button.addEventListener('click',async function(){
      button.disabled=true;
      try{
        activeSession=await window.HaberMember.session();
        if(!activeSession||!activeSession.user){location.href=nextLoginUrl();return;}
        var alreadySaved=button.dataset.saved==='true';
        var response=alreadySaved?await window.HaberMember.removeArticle(cleanArticleUrl()):await window.HaberMember.saveArticle(articleData());
        if(response.error)throw response.error;
        setButton(!alreadySaved);
        setMessage(alreadySaved?'Haber kayıtlarınızdan kaldırıldı.':'Haber hesabınıza kaydedildi.',false);
      }catch(error){
        setMessage('İşlem tamamlanamadı. Lütfen yeniden deneyin.',true);
      }finally{button.disabled=false;}
    });
  });
})();