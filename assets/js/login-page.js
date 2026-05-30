(function(){
  'use strict';
  function message(text,isError){
    const node=document.getElementById('member-message');
    if(!node)return;
    node.textContent=text||'';
    node.className='member-message'+(isError?' error':'');
  }
  function safeNextPath(){
    const raw=new URLSearchParams(window.location.search).get('next')||'';
    return /^\/[A-Za-z0-9/?&=_#.%+-]*$/.test(raw)&&raw.indexOf('//')!==0?raw:'/account.html';
  }
  function addForgotLink(){
    const login=document.getElementById('login-form');
    if(!login||document.getElementById('forgot-password-link'))return;
    const link=document.createElement('a');
    link.id='forgot-password-link';
    link.href='/forgot-password.html';
    link.textContent='Şifremi unuttum';
    link.style.display='inline-block';
    link.style.marginTop='10px';
    link.style.color='#e10600';
    link.style.fontWeight='900';
    login.insertAdjacentElement('afterend',link);
  }
  document.addEventListener('DOMContentLoaded',async function(){
    addForgotLink();
    const login=document.getElementById('login-form');
    const signup=document.getElementById('signup-form');
    const google=document.getElementById('google-login');
    const next=safeNextPath();
    try{
      const active=await HaberMember.session();
      if(active&&active.user){
        message('Oturumunuz açık. Yönlendiriliyorsunuz...');
        window.setTimeout(function(){location.href=next;},250);
        return;
      }
    }catch(error){
      /* Form remains available when session check fails. */
    }
    if(login){
      login.addEventListener('submit',async function(event){
        event.preventDefault();
        message('Giriş yapılıyor...');
        try{
          const response=await HaberMember.login(document.getElementById('login-email').value,document.getElementById('login-password').value);
          if(response.error)throw response.error;
          location.href=next;
        }catch(error){
          message(error.message||'Giriş başarısız.',true);
        }
      });
    }
    if(signup){
      signup.addEventListener('submit',async function(event){
        event.preventDefault();
        message('Üyelik oluşturuluyor...');
        try{
          const response=await HaberMember.register(document.getElementById('signup-email').value,document.getElementById('signup-password').value,document.getElementById('signup-name').value);
          if(response.error)throw response.error;
          if(response.data&&response.data.session){location.href=next;return;}
          message('Üyelik oluşturuldu. E-posta doğrulaması gerekiyorsa kutunuzu kontrol edip ardından giriş yapın.');
        }catch(error){
          message(error.message||'Üyelik oluşturulamadı.',true);
        }
      });
    }
    if(google){
      google.addEventListener('click',async function(){
        try{ await HaberMember.googleLogin(next); }
        catch(error){ message(error.message||'Google girişi başlatılamadı.',true); }
      });
    }
  });
})();