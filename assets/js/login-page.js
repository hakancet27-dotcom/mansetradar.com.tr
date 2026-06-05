(function(){
  'use strict';

  function message(text,isError){
    const node=document.getElementById('member-message');
    if(!node)return;
    node.textContent=text||'';
    node.className='member-message'+(isError?' error':'')+(text&&!isError?' success':'');
    if(text){
      node.hidden=false;
      window.setTimeout(function(){try{node.focus({preventScroll:false});}catch(error){}},10);
    }else{
      node.hidden=true;
    }
  }

  function clearFieldErrors(form){
    if(!form)return;
    form.querySelectorAll('.member-field-error').forEach(function(node){node.remove();});
    form.querySelectorAll('[aria-invalid="true"]').forEach(function(input){input.removeAttribute('aria-invalid');});
  }

  function fieldError(input,text){
    if(!input)return;
    input.setAttribute('aria-invalid','true');
    const note=document.createElement('small');
    note.className='member-field-error';
    note.textContent=text;
    const label=input.closest('label');
    if(label)label.insertAdjacentElement('afterend',note);
  }

  function emailValid(value){
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value||'').trim());
  }

  function validateAuthForm(form,mode){
    clearFieldErrors(form);
    const email=document.getElementById(mode==='login'?'login-email':'signup-email');
    const password=document.getElementById(mode==='login'?'login-password':'signup-password');
    let ok=true;
    if(!email||!email.value.trim()){
      fieldError(email,'E-posta adresinizi yazın.');
      ok=false;
    }else if(!emailValid(email.value)){
      fieldError(email,'Geçerli bir e-posta adresi yazın. Örnek: adiniz@mail.com');
      ok=false;
    }
    if(!password||!password.value){
      fieldError(password,'Şifrenizi yazın.');
      ok=false;
    }else if(mode==='signup'&&password.value.length<8){
      fieldError(password,'Şifre en az 8 karakter olmalı.');
      ok=false;
    }
    if(!ok){
      message('Bilgileri kontrol edin. Hatalı alanları kırmızıyla işaretledik.',true);
      const first=form.querySelector('[aria-invalid="true"]');
      if(first)first.focus();
    }
    return ok;
  }

  function friendlyError(error,fallback){
    const raw=String(error&&error.message||'').toLowerCase();
    if(raw.includes('invalid login')||raw.includes('invalid credentials'))return 'E-posta veya şifre hatalı. Bilgileri kontrol edip tekrar deneyin.';
    if(raw.includes('email')&&raw.includes('invalid'))return 'E-posta adresi geçerli görünmüyor. Lütfen doğru formatta yazın.';
    if(raw.includes('password')&&raw.includes('short'))return 'Şifre çok kısa. En az 8 karakter kullanın.';
    if(raw.includes('already registered')||raw.includes('already exists'))return 'Bu e-posta ile daha önce üyelik oluşturulmuş. Giriş yapmayı deneyin.';
    if(raw.includes('rate limit'))return 'Çok fazla deneme yapıldı. Biraz sonra tekrar deneyin.';
    return error&&error.message?error.message:fallback;
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
    link.className='member-auth-link';
    login.insertAdjacentElement('afterend',link);
  }

  function setLoading(button,isLoading,text){
    if(!button)return;
    if(isLoading){
      button.dataset.defaultText=button.textContent;
      button.textContent=text;
      button.disabled=true;
    }else{
      button.textContent=button.dataset.defaultText||button.textContent;
      button.disabled=false;
    }
  }

  document.addEventListener('DOMContentLoaded',async function(){
    addForgotLink();
    message('');
    const login=document.getElementById('login-form');
    const signup=document.getElementById('signup-form');
    const google=document.getElementById('google-login');
    const next=safeNextPath();
    try{
      const active=await HaberMember.session();
      if(active&&active.user){
        message('Oturumunuz açık. Hesabınıza yönlendiriliyorsunuz...');
        window.setTimeout(function(){location.href=next;},250);
        return;
      }
    }catch(error){
      /* Form remains available when session check fails. */
    }
    if(login){
      login.addEventListener('submit',async function(event){
        event.preventDefault();
        if(!validateAuthForm(login,'login'))return;
        const button=login.querySelector('button[type="submit"]');
        message('Giriş yapılıyor...');
        setLoading(button,true,'Giriş yapılıyor...');
        try{
          const response=await HaberMember.login(document.getElementById('login-email').value.trim(),document.getElementById('login-password').value);
          if(response.error)throw response.error;
          location.href=next;
        }catch(error){
          message(friendlyError(error,'Giriş başarısız. Bilgileri kontrol edip tekrar deneyin.'),true);
        }finally{
          setLoading(button,false);
        }
      });
    }
    if(signup){
      signup.addEventListener('submit',async function(event){
        event.preventDefault();
        if(!validateAuthForm(signup,'signup'))return;
        const button=signup.querySelector('button[type="submit"]');
        message('Üyelik oluşturuluyor...');
        setLoading(button,true,'Üyelik oluşturuluyor...');
        try{
          const response=await HaberMember.register(document.getElementById('signup-email').value.trim(),document.getElementById('signup-password').value,document.getElementById('signup-name').value.trim());
          if(response.error)throw response.error;
          if(response.data&&response.data.session){location.href=next;return;}
          message('Üyelik oluşturuldu. E-posta doğrulaması gerekiyorsa gelen kutunuzu kontrol edip ardından giriş yapın.');
        }catch(error){
          message(friendlyError(error,'Üyelik oluşturulamadı. Bilgileri kontrol edip tekrar deneyin.'),true);
        }finally{
          setLoading(button,false);
        }
      });
    }
    if(google){
      google.addEventListener('click',async function(){
        setLoading(google,true,'Google açılıyor...');
        try{ await HaberMember.googleLogin(next); }
        catch(error){
          message(friendlyError(error,'Google girişi başlatılamadı.'),true);
          setLoading(google,false);
        }
      });
    }
  });
})();