export class AudioEngine{
 constructor(){this.enabled=true;this.volume=.5;this.ctx=null;}
 unlock(){try{this.ctx??=new AudioContext();this.ctx.resume();if(!this.noise){this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate);const d=this.noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}}catch{}}
 tone(freq,duration,volume=.1,kind='sine',delay=0){if(!this.enabled||!this.ctx)return;const c=this.ctx,t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type=kind;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,freq*.4),t+duration);g.gain.setValueAtTime(volume*this.volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+duration);}
 burst(duration,volume,cutoff,pan=0){if(!this.enabled||!this.ctx||!this.noise)return;const c=this.ctx,t=c.currentTime,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),p=c.createStereoPanner();s.buffer=this.noise;f.type='lowpass';f.frequency.value=cutoff;g.gain.setValueAtTime(volume*this.volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);p.pan.value=pan;s.connect(f);f.connect(g);g.connect(p);p.connect(c.destination);s.start(t,Math.random()*.5);s.stop(t+duration);}
 shot(id,volume=1,pan=0){this.burst([.13,.085,.24,.27][id],[.38,.26,.65,.6][id]*volume,[2600,3800,1800,2200][id],pan);this.tone([90,130,60,70][id],.12,.18*volume,'triangle');}
 hit(head=false){this.tone(head?1700:1050,.075,.12);if(head)this.tone(2200,.05,.08,'sine',.045);}
 // 05.2 confirmation is invoked ONLY by an authoritative server hit event.
 // Keep it short and quieter than gunfire so overlapping rounds remain clear.
 confirm52(head=false,killed=false){
  if(!this.enabled||!this.ctx||this.volume<=0)return;
  this.tone(head?1540:1040,.062,head?.083:.055,'sine');
  if(head)this.tone(2010,.045,.04,'triangle',.024);
  if(killed)this.tone(680,.095,.05,'sine',.038);
 }
 kill(){this.tone(700,.1,.1);this.tone(1050,.14,.1,'sine',.08);}
 tier(){this.tone(620,.1,.09,'triangle');this.tone(840,.13,.08,'sine',.08);this.tone(1040,.16,.07,'sine',.17);}
 streak(){this.tone(740,.085,.07,'sine');this.tone(980,.1,.075,'sine',.085);}
 finish(won=false){this.tone(won?850:480,.18,.08,'triangle');this.tone(won?1200:300,.28,.07,'sine',.15);}
 dry(){this.tone(360,.045,.065,'square');}
 reload(){this.burst(.075,.18,4600);this.tone(220,.06,.04,'square',.3);}
 step(volume=.08){this.burst(.09,volume,600);}
 // Phase 4.5: small positional city ambience cues; bounded lifetime and
 // shared master volume. Only called after a player gesture unlocks audio.
 ambience(zone,volume=.12,pan=0){
  if(!this.enabled||!this.ctx||this.volume<=0)return;
  const c=this.ctx,t=c.currentTime;
  const frequencies={market:[112,171],plaza:[154,236],atrium:[77,128],transit:[92,138]};
  const notes=frequencies[zone]||frequencies.plaza;
  const p=c.createStereoPanner();p.pan.setValueAtTime(Math.max(-.8,Math.min(.8,pan)),t);
  p.connect(c.destination);
  for(const [i,freq] of notes.entries()){
   const o=c.createOscillator(),g=c.createGain(),dur=1.5+i*.3;
   o.type=i===0?'sine':'triangle';
   o.frequency.setValueAtTime(freq,t);
   o.frequency.linearRampToValueAtTime(freq*(1+(i?-.035:.035)),t+dur);
   const level=Math.max(.00001,volume*this.volume*(i===0?.18:.055));
   g.gain.setValueAtTime(.00001,t);
   g.gain.linearRampToValueAtTime(level,t+.16);
   g.gain.exponentialRampToValueAtTime(.00001,t+dur);
   o.connect(g);g.connect(p);o.start(t);o.stop(t+dur+.01);
  }
  // Short, distant station air rather than a permanent high-CPU noise loop.
  if(zone==='transit')this.burst(.27,volume*.11,720,pan);
 }
}
