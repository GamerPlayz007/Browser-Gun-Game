      // Visible native-render startup diagnostics: never leave the player with a blank screen.
      (function(){
        var screen=document.createElement('div');
        screen.id='crossfire-native-status';
        screen.style.cssText='position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;background:#060b15;color:#e5f9ff;font:14px system-ui,sans-serif;padding:24px;text-align:center';
        screen.innerHTML='<div style="max-width:640px"><h1 style="letter-spacing:.16em;font-size:20px">CROSSFIRE / NEON ZENITH</h1><p id="crossfire-native-message">Loading the original city renderer and assets…</p><p style="color:#90b6c8;font-size:12px">High-fidelity environment test · The first load can be demanding.</p><a href="/" style="color:#5be6ea">Back to CROSSFIRE</a></div>';
        document.addEventListener('DOMContentLoaded',function(){document.body.appendChild(screen);});
        var problem=false;
        function showError(message){
          problem=true;
          var messageNode=document.getElementById('crossfire-native-message');
          if(messageNode)messageNode.textContent='Unable to start original city: '+String(message).slice(0,450);
          var title=screen.querySelector('h1');if(title)title.style.color='#ffb7ad';
          console.error('CROSSFIRE Neon startup:',message);
        }
        window.addEventListener('error',function(e){showError(e.message||'JavaScript or resource failed to load')});
        window.addEventListener('unhandledrejection',function(e){showError(e.reason?.message||e.reason||'Renderer promise rejected')});
        window.__crossfireNeonReady=function(){
          if(!problem)screen.remove();
        };
        setTimeout(function(){
          if(!window.__nz?.ready && !problem){
            var m=document.getElementById('crossfire-native-message');
            if(m)m.textContent='Still loading or compiling graphics. If this remains here, try the WebGL compatibility link below.';
            if(!document.getElementById('cf-fallback')){
              var a=document.createElement('a');a.id='cf-fallback';a.href='/neon/?crossfire&webgl';a.textContent='Try WebGL compatibility mode';
              a.style.cssText='display:block;margin:18px auto;color:#8ff4e9';screen.querySelector('div').appendChild(a);
            }
          }
        },20000);
      })();
