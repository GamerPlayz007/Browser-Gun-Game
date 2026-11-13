// Matches server movement: acceleration, step-up, ceiling collisions, and sliding.
export function simulate(p,input,dt,now,boxes,weapon){
 let f=Number(!!input.w)-Number(!!input.s),r=Number(!!input.d)-Number(!!input.a),len=Math.max(1,Math.hypot(f,r));f/=len;r/=len;
 if(input.slide&&!p.slide_held&&p.grounded&&now>=p.slide_ready&&Math.hypot(p.vx,p.vz)>4){p.slide_until=now+.65;p.slide_ready=now+1.7;len=Math.max(.1,Math.hypot(p.vx,p.vz));p.vx=p.vx/len*11;p.vz=p.vz/len*11;}
 p.slide_held=!!input.slide;const sliding=now<p.slide_until;p.crouch=sliding;
 if(!sliding){let speed=(input.sprint&&!input.ads?8:5.6)*weapon.speed;if(input.ads)speed*=.62;const blend=Math.min(1,dt*(p.grounded?18:5));p.vx+=((r*Math.cos(p.yaw)-f*Math.sin(p.yaw))*speed-p.vx)*blend;p.vz+=((-r*Math.sin(p.yaw)-f*Math.cos(p.yaw))*speed-p.vz)*blend;}else{p.vx*=Math.exp(-1.1*dt);p.vz*=Math.exp(-1.1*dt);}
 let height=sliding?1.05:1.8;const overlaps=(x,y,z,b,h=height)=>Math.abs(x-b.x)<b.w/2+.32&&Math.abs(z-b.z)<b.d/2+.32&&y<b.y+b.h-.015&&y+h>b.y+.015;
 if(!sliding&&boxes.some(b=>overlaps(p.x,p.y,p.z,b))){p.crouch=true;height=1.05;}
 for(const [axis,velocity] of [['x','vx'],['z','vz']]){const value=p[axis]+p[velocity]*dt,x=axis==='x'?value:p.x,z=axis==='z'?value:p.z;let obstacles=boxes.filter(b=>overlaps(x,p.y,z,b));if(obstacles.length&&p.grounded){const top=Math.max(...obstacles.map(b=>b.y+b.h));if(top-p.y<=.29&&!boxes.some(b=>overlaps(x,top,z,b))){p.y=top;obstacles=[];}}if(!obstacles.length)p[axis]=value;else p[velocity]=0;}
 if(input.jump&&!p.jump_held&&p.grounded){p.vy=7.5;p.grounded=false;p.slide_until=0;}p.jump_held=!!input.jump;
 const old=p.y;p.vy-=22*dt;let ny=old+p.vy*dt,ground=0;
 for(const b of boxes){if(Math.abs(p.x-b.x)<b.w/2+.32&&Math.abs(p.z-b.z)<b.d/2+.32){const top=b.y+b.h;if(p.vy<=0&&old>=top-.02)ground=Math.max(ground,top);if(p.vy>0&&old+height<=b.y+.02&&ny+height>=b.y){ny=b.y-height;p.vy=0;}}}
 if(ny<=ground){ny=ground;p.vy=0;p.grounded=true;}else p.grounded=false;p.y=ny;
}
