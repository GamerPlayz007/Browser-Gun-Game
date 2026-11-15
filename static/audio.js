export class AudioEngine{
 constructor(){this.enabled=true;this.volume=.5;this.ctx=null;}
 unlock(){try{this.ctx??=new AudioContext();this.ctx.resume();if(!this.noise){this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate);const d=this.noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}}catch{}}
 tone(freq,duration,volume=.1,kind='sine',delay=0){if(!this.enabled||!this.ctx)return;const c=this.ctx,t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type=kind;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,freq*.4),t+duration);g.gain.setValueAtTime(volume*this.volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+duration);}
 burst(duration,volume,cutoff,pan=0){if(!this.enabled||!this.ctx||!this.noise)return;const c=this.ctx,t=c.currentTime,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),p=c.createStereoPanner();s.buffer=this.noise;f.type='lowpass';f.frequency.value=cutoff;g.gain.setValueAtTime(volume*this.volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);p.pan.value=pan;s.connect(f);f.connect(g);g.connect(p);p.connect(c.destination);s.start(t,Math.random()*.5);s.stop(t+duration);}
 shot(id,volume=1,pan=0){this.burst([.13,.085,.24,.27][id],[.38,.26,.65,.6][id]*volume,[2600,3800,1800,2200][id],pan);this.tone([90,130,60,70][id],.12,.18*volume,'triangle');}
 hit(head=false){this.tone(head?1700:1050,.075,.12);if(head)this.tone(2200,.05,.08,'sine',.045);}
 kill(){this.tone(700,.1,.1);this.tone(1050,.14,.1,'sine',.08);}
 dry(){this.tone(360,.045,.065,'square');}
 reload(){this.burst(.075,.18,4600);this.tone(220,.06,.04,'square',.3);}
 step(volume=.08){this.burst(.09,volume,600);}
}
