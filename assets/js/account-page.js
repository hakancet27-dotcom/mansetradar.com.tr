(function(){
  'use strict';

  var CATEGORIES=[
    {value:'son-dakika',label:'Son Dakika'},
    {value:'gundem',label:'Gündem'},
    {value:'siyaset',label:'Siyaset'},
    {value:'ekonomi',label:'Ekonomi'},
    {value:'dunya',label:'Dünya'},
    {value:'spor',label:'Spor'},
    {value:'magazin',label:'Magazin'},
    {value:'teknoloji',label:'Teknoloji'},
    {value:'saglik',label:'Sağlık'},
    {value:'video',label:'Video'}
  ];
  function node(id){return document.getElementById(id);}
  function setText(id,value){var target=node(id);if(target)target.textContent=value||'';}
  function metadataName(user){
    var metadata=user&&user.user_metadata?user.user_metadata:{};
    var name=String(metadata.display_name||metadata.full_name||metadata.name||'').trim();
    if(name)return name;
    var email=String(user&&user.email||'');
    return email?email.split('@')[0]:'Üye';
  }
  function statusText(target,text,isError){
    if(!target)return;
    target.textContent=text||'';
    target.className='member-message'+(isError?' error':'');
  }
  function actionButton(label,className){
    var item=document.createElement('button');
    item.type='button';item.className=className||'member-inline-btn';item.textContent=label;
    return item;
  }

  document.addEventListener('DOMContentLoaded',async function(){
    try{
      var active=await HaberMember.requireMember();
      if(!active)return;
      var currentUser=await HaberMember.user();
      var title=document.querySelector('.member-top h1');
      if(title)title.textContent='Hesabım';
      setText('member-greeting','Hoş geldin, '+metadataName(currentUser));
      setText('member-email',currentUser&&currentUser.email);

      var headerInfo=document.querySelector('.member-top > div');
      if(headerInfo&&!node('session-status')){
        var activeBadge=document.createElement('p');
        activeBadge.id='session-status';activeBadge.className='member-session-status';activeBadge.textContent='✓ Oturumunuz açık';
        headerInfo.appendChild(activeBadge);
      }
      var logout=node('logout');
      if(logout)logout.addEventListener('click',async function(){await HaberMember.logout();location.href='/haber/';});

      var panels=document.querySelectorAll('.member-panel');
      var savedPanel=panels[0];
      var notificationPanel=panels[1];
      if(savedPanel){
        savedPanel.id='saved';
        var savedHeading=savedPanel.querySelector('h2');
        if(savedHeading)savedHeading.textContent='Kaydettiklerim';
        if(!node('saved-message')){
          var savedMessage=document.createElement('p');
          savedMessage.id='saved-message';savedMessage.className='member-message';savedPanel.appendChild(savedMessage);
        }
      }
      var savedList=node('saved-list');
      var savedCount=0;
      function updateSavedCount(){var count=node('saved-count');if(count)count.textContent=String(savedCount);}
      function emptySavedMessage(){
        var empty=document.createElement('p');
        empty.className='member-muted';
        empty.textContent='Henüz kaydettiğiniz haber yok. Haber detayında “Haberi Kaydet” seçeneğini kullanabilirsiniz.';
        return empty;
      }
      async function removeSavedArticle(item,row){
        var response=await HaberMember.removeArticle(item.article_url);
        if(response.error)throw response.error;
        row.remove();savedCount=Math.max(0,savedCount-1);updateSavedCount();
        if(savedList&&!savedList.querySelector('.member-saved-row'))savedList.appendChild(emptySavedMessage());
      }
      function renderSavedItem(item){
        var row=document.createElement('div');row.className='member-saved-row';
        var link=document.createElement('a');link.href=item.article_url||'#';link.textContent=item.article_title||item.article_url||'Haber';link.className='member-saved-title';
        var actions=document.createElement('div');actions.className='member-saved-actions';
        var open=document.createElement('a');open.href=item.article_url||'#';open.textContent='Habere Git';open.className='member-inline-btn';
        var remove=actionButton('Kaldır','member-inline-btn danger');
        remove.addEventListener('click',async function(){
          remove.disabled=true;
          try{await removeSavedArticle(item,row);statusText(node('saved-message'),'Haber kayıtlarınızdan kaldırıldı.',false);}
          catch(error){remove.disabled=false;statusText(node('saved-message'),'Kayıt kaldırılamadı. Tekrar deneyin.',true);}
        });
        actions.appendChild(open);actions.appendChild(remove);row.appendChild(link);row.appendChild(actions);return row;
      }
      if(savedList){
        var result=await HaberMember.savedArticles();
        savedList.textContent='';
        if(result.error){
          statusText(node('saved-message'),'Kaydedilen haberler şu anda yüklenemedi.',true);
        }else if(!result.data||!result.data.length){
          savedList.appendChild(emptySavedMessage());
        }else{
          savedCount=result.data.length;
          result.data.forEach(function(item){savedList.appendChild(renderSavedItem(item));});
        }
      }

      var summary=document.createElement('section');
      summary.className='member-summary';
      summary.innerHTML='<div><strong id="saved-count">0</strong><span>Kaydedilen Haber</span></div><div><strong>Standart</strong><span>Üyelik Durumu</span></div><div><strong>Aktif</strong><span>Hesap</span></div>';
      var grid=document.querySelector('.member-grid');
      if(grid)grid.parentNode.insertBefore(summary,grid);
      updateSavedCount();

      var prefs={email_daily_digest:false,breaking_news_push:false,categories:[]};
      var stored=await HaberMember.loadPrefs();
      if(!stored.error&&stored.data){
        prefs.email_daily_digest=!!stored.data.email_daily_digest;
        prefs.breaking_news_push=!!stored.data.breaking_news_push;
        prefs.categories=Array.isArray(stored.data.categories)?stored.data.categories:[];
      }
      if(notificationPanel){
        notificationPanel.id='notifications';
        notificationPanel.innerHTML='<h2>Bildirim Tercihleri</h2><p class="member-notice">Bildirim sistemi hazırlık aşamasında. Buradaki seçimler yalnızca tercih kaydıdır; şu anda aktif bildirim gönderimi yapılmaz.</p><form id="prefs-form" class="member-form"><label><input id="pref-mail" type="checkbox"> Günlük e-posta özeti</label><label><input id="pref-push" type="checkbox"> Son dakika bildirimi</label><button class="member-btn" type="submit">Tercihleri Kaydet</button></form><p id="prefs-message" class="member-message"></p>';
        node('pref-mail').checked=prefs.email_daily_digest;node('pref-push').checked=prefs.breaking_news_push;
        if(stored.error)statusText(node('prefs-message'),'Kayıtlı tercihler şu anda yüklenemedi.',true);
        node('prefs-form').addEventListener('submit',async function(event){
          event.preventDefault();prefs.email_daily_digest=!!node('pref-mail').checked;prefs.breaking_news_push=!!node('pref-push').checked;
          var response=await HaberMember.savePrefs(prefs);
          statusText(node('prefs-message'),response.error?'Tercihler kaydedilemedi. Tekrar deneyin.':'Tercihleriniz kaydedildi. Bildirimler henüz gönderime açılmadı.',!!response.error);
        });
      }
      if(grid){
        var interestPanel=document.createElement('section');
        interestPanel.className='member-panel member-interest-panel';interestPanel.id='interests';
        var checkboxes=CATEGORIES.map(function(category){return '<label class="member-interest"><input type="checkbox" name="interest" value="'+category.value+'"> '+category.label+'</label>';}).join('');
        interestPanel.innerHTML='<h2>İlgi Alanlarım</h2><p class="member-muted">Takip etmek istediğiniz başlıkları seçin. Seçimleriniz hesabınıza kaydedilir; kişiselleştirilmiş haber alanı sonraki aşamada devreye alınacaktır.</p><form id="interests-form" class="member-form"><div class="member-interest-grid">'+checkboxes+'</div><button class="member-btn" type="submit">İlgi Alanlarını Kaydet</button></form><p id="interests-message" class="member-message"></p>';
        grid.appendChild(interestPanel);
        prefs.categories.forEach(function(category){var checkbox=interestPanel.querySelector('input[value="'+category+'"]');if(checkbox)checkbox.checked=true;});
        node('interests-form').addEventListener('submit',async function(event){
          event.preventDefault();prefs.categories=Array.prototype.slice.call(interestPanel.querySelectorAll('input[name="interest"]:checked')).map(function(input){return input.value;});
          var response=await HaberMember.savePrefs(prefs);
          statusText(node('interests-message'),response.error?'İlgi alanları kaydedilemedi. Tekrar deneyin.':'İlgi alanlarınız kaydedildi.',!!response.error);
        });
      }
      if(location.hash)window.setTimeout(function(){var target=document.querySelector(location.hash);if(target)target.scrollIntoView({behavior:'smooth',block:'start'});},50);
    }catch(error){setText('member-error',error.message||'Hesap bilgileri alınamadı.');}
  });
})();
