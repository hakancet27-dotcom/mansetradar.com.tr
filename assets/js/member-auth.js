(function(){
  'use strict';

  const SDK='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  let configPromise=null;

  function readMeta(root,name){
    const element=root.querySelector('meta[name="'+name+'"]');
    return element?String(element.content||'').trim():'';
  }

  async function memberConfig(){
    const local={url:readMeta(document,'haber-member-url'),key:readMeta(document,'haber-member-public')};
    if(local.url&&local.key)return local;
    if(!configPromise){
      configPromise=fetch('/login.html',{cache:'no-store'}).then(function(response){
        if(!response.ok)throw new Error('Üyelik bağlantısı yüklenemedi.');
        return response.text();
      }).then(function(markup){
        const doc=new DOMParser().parseFromString(markup,'text/html');
        const config={url:readMeta(doc,'haber-member-url'),key:readMeta(doc,'haber-member-public')};
        if(!config.url||!config.key)throw new Error('Üyelik bağlantısı yapılandırılmamış.');
        return config;
      });
    }
    return configPromise;
  }

  function sdk(){
    return new Promise(function(resolve,reject){
      if(window.supabase){resolve();return;}
      const script=document.createElement('script');
      script.src=SDK;
      script.async=true;
      script.onload=resolve;
      script.onerror=function(){reject(new Error('Üyelik bağlantısı yüklenemedi.'));};
      document.head.appendChild(script);
    });
  }

  async function client(){
    await sdk();
    if(window.haberMemberClient)return window.haberMemberClient;
    const config=await memberConfig();
    window.haberMemberClient=window.supabase.createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    return window.haberMemberClient;
  }

  async function session(){
    const instance=await client();
    const response=await instance.auth.getSession();
    if(response.error)throw response.error;
    return response.data.session;
  }

  async function user(){
    const instance=await client();
    const response=await instance.auth.getUser();
    if(response.error)throw response.error;
    return response.data.user;
  }

  async function requiredUser(){
    const currentUser=await user();
    if(!currentUser)throw new Error('Oturum açmanız gerekiyor.');
    return currentUser;
  }

  async function login(email,password){
    const instance=await client();
    return instance.auth.signInWithPassword({email:email,password:password});
  }

  async function register(email,password,displayName){
    const instance=await client();
    return instance.auth.signUp({email:email,password:password,options:{data:{display_name:displayName||''}}});
  }

  async function googleLogin(returnTo){
    const instance=await client();
    const path=typeof returnTo==='string'&&/^\/[A-Za-z0-9/?&=_#.-]*$/.test(returnTo)?returnTo:'/account.html';
    const redirectTo=new URL(path,window.location.origin).toString();
    const response=await instance.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirectTo}});
    if(response.error)throw response.error;
    return response;
  }

  async function logout(){
    const instance=await client();
    return instance.auth.signOut();
  }

  async function requireMember(){
    const active=await session();
    if(!active){location.href='/login.html';return null;}
    return active;
  }

  async function saveArticle(article){
    const instance=await client();
    const currentUser=await requiredUser();
    return instance.from('saved_articles').upsert({user_id:currentUser.id,article_url:article.url,article_title:article.title,article_slug:article.slug||''},{onConflict:'user_id,article_url'});
  }

  async function removeArticle(articleUrl){
    const instance=await client();
    const currentUser=await requiredUser();
    return instance.from('saved_articles').delete().eq('user_id',currentUser.id).eq('article_url',articleUrl);
  }

  async function isArticleSaved(articleUrl){
    const instance=await client();
    const currentUser=await requiredUser();
    return instance.from('saved_articles').select('id').eq('user_id',currentUser.id).eq('article_url',articleUrl).maybeSingle();
  }

  async function savedArticles(){
    const instance=await client();
    const currentUser=await requiredUser();
    return instance.from('saved_articles').select('id,article_url,article_title,article_slug,created_at').eq('user_id',currentUser.id).order('created_at',{ascending:false});
  }

  async function loadPrefs(){
    const instance=await client();
    const currentUser=await requiredUser();
    return instance.from('notification_preferences').select('email_daily_digest,breaking_news_push,categories,updated_at').eq('user_id',currentUser.id).maybeSingle();
  }

  async function savePrefs(prefs){
    const instance=await client();
    const currentUser=await requiredUser();
    return instance.from('notification_preferences').upsert({user_id:currentUser.id,email_daily_digest:!!prefs.email_daily_digest,breaking_news_push:!!prefs.breaking_news_push,categories:Array.isArray(prefs.categories)?prefs.categories:[]},{onConflict:'user_id'});
  }

  window.HaberMember={client:client,session:session,user:user,login:login,register:register,googleLogin:googleLogin,logout:logout,requireMember:requireMember,saveArticle:saveArticle,removeArticle:removeArticle,isArticleSaved:isArticleSaved,savedArticles:savedArticles,loadPrefs:loadPrefs,savePrefs:savePrefs};
})();
